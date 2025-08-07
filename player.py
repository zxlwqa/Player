import os
import string
import argparse
import requests
from huggingface_hub import HfApi, create_repo, CommitOperationAdd
from huggingface_hub.utils import HfHubHTTPError

def get_unused_space_name(hf_user, token):
    api = HfApi(token=token)
    used = [repo.id.split("/")[-1] for repo in api.list_spaces(author=hf_user)]
    for letter in string.ascii_uppercase:
        if letter not in used:
            return letter
    raise Exception("你已用尽 A-Z 的所有 Space 名称，请手动删除一些或指定 space_name。")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf_token", required=True, help="Hugging Face token")
    parser.add_argument("--hf_user", required=True, help="Hugging Face username")
    parser.add_argument("--space_name", default=None, help="Space 名称（默认自动 A-Z）")
    args = parser.parse_args()

    hf_token = args.hf_token
    hf_user = args.hf_user
    space_name = args.space_name or get_unused_space_name(hf_user, hf_token)

    repo_id = f"{hf_user}/{space_name}"
    print(f"创建或确认 Space: {repo_id}")

    api = HfApi(token=hf_token)
    try:
        create_repo(
            name=space_name,
            token=hf_token,
            repo_type="space",
            space_sdk="docker"
        )
        print("Space 创建成功")
    except HfHubHTTPError as e:
        if "Repo already exists" in str(e):
            print("Space 已存在，继续操作")
        else:
            raise e

    # 下载 Dockerfile
    dockerfile_url = "https://raw.githubusercontent.com/zxlwq/Player/main/Dockerfile"
    dockerfile_content = requests.get(dockerfile_url).text

    # 获取 README.md（如果不存在则设为初始值）
    try:
        readme_url = f"https://huggingface.co/spaces/{repo_id}/raw/main/README.md"
        readme_content = requests.get(readme_url).text
    except:
        readme_content = ""

    # 追加 app_port: 3000
    if "app_port:" not in readme_content:
        readme_content += "\napp_port: 3000\n"

    # 提交文件
    print("提交 Dockerfile 和 README.md 到 Space")
    api.create_commit(
        repo_id=repo_id,
        repo_type="space",
        operations=[
            CommitOperationAdd(path_in_repo="Dockerfile", path_or_fileobj=dockerfile_content, is_bytes=False),
            CommitOperationAdd(path_in_repo="README.md", path_or_fileobj=readme_content, is_bytes=False),
        ],
        commit_message="Deploy Dockerfile to Space",
    )
    print(f"✅ 已部署到 Space: https://huggingface.co/spaces/{repo_id}")

if __name__ == "__main__":
    main()
