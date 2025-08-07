import argparse
import random
import string
import requests
from huggingface_hub import (
    HfApi,
    create_repo,
    CommitOperationAdd,
    create_commit,
    HfHubHTTPError,
)

def generate_space_name():
    return random.choice(string.ascii_uppercase)

def get_unused_space_name(hf_user, hf_token):
    api = HfApi(token=hf_token)
    existing = api.list_spaces(author=hf_user)
    used_names = [space.id.split("/")[-1] for space in existing]
    for _ in range(26):
        name = generate_space_name()
        if name not in used_names:
            return name
    raise Exception("No available single-letter space name.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf_token", required=True, help="Hugging Face token")
    parser.add_argument("--hf_user", required=True, help="Hugging Face username")
    parser.add_argument("--space_name", help="Optional: specify Space name")
    args = parser.parse_args()

    hf_token = args.hf_token
    hf_user = args.hf_user
    space_name = args.space_name or get_unused_space_name(hf_user, hf_token)

    print(f"创建或确认 Space: {hf_user}/{space_name}")

    try:
        create_repo(
            repo_id=space_name,
            repo_type="space",
            space_sdk="docker",
            token=hf_token
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

    # 获取 README.md 并追加
    api = HfApi(token=hf_token)
    try:
        existing_readme = api.hf_hub_download(
            repo_id=f"{hf_user}/{space_name}",
            filename="README.md",
            repo_type="space"
        )
        with open(existing_readme, "r") as f:
            readme_content = f.read()
    except:
        readme_content = ""

    if "app_port:" not in readme_content:
        readme_content += "\napp_port: 3000\n"

    # 提交文件
    print("提交 Dockerfile 和 README.md 到 Space")
    create_commit(
        repo_id=f"{hf_user}/{space_name}",
        repo_type="space",
        token=hf_token,
        operations=[
            CommitOperationAdd(path_in_repo="Dockerfile", path_or_fileobj=dockerfile_url),
            CommitOperationAdd(path_in_repo="README.md", content=readme_content.encode("utf-8")),
        ],
        commit_message="Init Dockerfile and README.md with app_port"
    )

if __name__ == "__main__":
    main()
