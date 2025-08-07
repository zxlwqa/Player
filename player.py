import os
import argparse
import random
import string
import tempfile
from huggingface_hub import HfApi, CommitOperationAdd, HfFileSystem

def get_unused_space_name(hf_user, hf_token):
    api = HfApi(token=hf_token)
    existing_spaces = api.list_spaces(author=hf_user)
    used_names = [space.id.split("/")[-1] for space in existing_spaces]
    while True:
        name = ''.join(random.choices(string.ascii_uppercase, k=1))
        if name not in used_names:
            return name

def update_readme(original: str) -> str:
    lines = original.splitlines(keepends=True)
    new_lines = []
    in_yaml = False
    inserted = False

    for line in lines:
        if line.strip() == "---":
            if not in_yaml:
                # 遇到第一个 ---
                in_yaml = True
                new_lines.append(line)
                continue
            else:
                # 遇到第二个 ---，插入 app_port 并结束 YAML 头部
                if not inserted:
                    new_lines.append("app_port: 3000\n")
                    inserted = True
                new_lines.append(line)
                in_yaml = False
                continue
        new_lines.append(line)

    # 如果没有找到 YAML 头，则新增一个带 app_port 的简单 YAML 头部
    if not inserted:
        yaml_header = (
            "---\n"
            "app_port: 3000\n"
            "---\n"
        )
        return yaml_header + original

    return "".join(new_lines)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--hf_token', type=str, required=True)
    parser.add_argument('--hf_user', type=str, required=True)
    args = parser.parse_args()

    hf_token = args.hf_token
    hf_user = args.hf_user

    api = HfApi(token=hf_token)
    fs = HfFileSystem(token=hf_token)

    space_name = get_unused_space_name(hf_user, hf_token)
    repo_id = f"{hf_user}/{space_name}"
    print(f"创建或确认 Space: {repo_id}")

    # 1. 创建 Space，exist_ok=True 防止重复异常
    api.create_repo(
        repo_id=repo_id,
        token=hf_token,
        repo_type="space",
        space_sdk="docker",
        exist_ok=True,
    )

    # 2. 下载 Dockerfile
    import requests
    dockerfile_url = "https://raw.githubusercontent.com/zxlwq/Player/main/Dockerfile"
    dockerfile_content = requests.get(dockerfile_url).text
    print("下载 Dockerfile:", dockerfile_url)

    # 3. 获取并更新 README.md
    readme_text = """---
title: O
emoji: 📉
colorFrom: gray
colorTo: yellow
sdk: docker
pinned: false
---
"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            readme_path = api.hf_hub_download(repo_id=repo_id, filename="README.md", repo_type="space", token=hf_token, local_dir=tmpdir)
            with open(readme_path, "r", encoding="utf-8") as f:
                readme_text = f.read()
    except Exception:
        print("使用默认 README 模板")

    updated_readme = update_readme(readme_text)

    # 4. 提交文件
    api.create_commit(
        repo_id=repo_id,
        repo_type="space",
        operations=[
            CommitOperationAdd(path_in_repo="Dockerfile", path_or_fileobj=dockerfile_content.encode("utf-8")),
            CommitOperationAdd(path_in_repo="README.md", path_or_fileobj=updated_readme.encode("utf-8")),
        ],
        commit_message="Initialize Space with Dockerfile and updated README",
    )

    print("✅ Hugging Face Space 初始化完成：", f"https://huggingface.co/spaces/{repo_id}")

if __name__ == "__main__":
    main()
