import argparse
import random
import string
import requests
from huggingface_hub import (
    HfApi,
    CommitOperationAdd,
    create_repo,
    upload_folder,
    update_repo_visibility,
)
from huggingface_hub.utils import RepositoryNotFoundError

def get_unused_space_name(hf_user: str, hf_token: str) -> str:
    api = HfApi(token=hf_token)
    used = [s.id.split("/")[-1] for s in api.list_spaces(author=hf_user)]
    for _ in range(100):
        name = random.choice(string.ascii_uppercase)
        if name not in used:
            return name
    raise RuntimeError("无法找到未使用的 Space 名称")

def download_file(url: str) -> str:
    response = requests.get(url)
    response.raise_for_status()
    return response.text

def append_app_port_to_readme(readme: str) -> str:
    if "app_port:" not in readme:
        readme += "\n\napp_port: 3000\n"
    return readme

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf_token", required=True)
    parser.add_argument("--hf_user", required=True)
    parser.add_argument("--space_name", required=False)
    args = parser.parse_args()

    hf_token = args.hf_token
    hf_user = args.hf_user
    space_name = args.space_name or get_unused_space_name(hf_user, hf_token)
    full_repo_id = f"{hf_user}/{space_name}"

    api = HfApi(token=hf_token)

    print(f"创建或确认 Space: {full_repo_id}")
    try:
        api.repo_info(repo_id=full_repo_id, repo_type="space")
    except RepositoryNotFoundError:
        create_repo(repo_id=full_repo_id, token=hf_token, repo_type="space", space_sdk="docker")

    print("下载 Dockerfile: https://raw.githubusercontent.com/zxlwq/Player/main/Dockerfile")
    dockerfile_content = download_file("https://raw.githubusercontent.com/zxlwq/Player/main/Dockerfile")

    print("获取当前 README.md 内容")
    try:
        readme_content = api.hub_request(f"/spaces/{full_repo_id}/raw/main/README.md", token=hf_token).text
    except Exception:
        readme_content = ""

    updated_readme = append_app_port_to_readme(readme_content)

    print("上传 Dockerfile 与 README.md 到 Space")
    api.create_commit(
        repo_id=full_repo_id,
        repo_type="space",
        operations=[
            CommitOperationAdd(path_in_repo="Dockerfile", path_or_fileobj=dockerfile_content.encode()),
            CommitOperationAdd(path_in_repo="README.md", path_or_fileobj=updated_readme.encode()),
        ],
        commit_message="Add Dockerfile and update README.md with app_port",
    )

    print(f"✅ Space 创建或更新成功: https://huggingface.co/spaces/{full_repo_id}")

if __name__ == "__main__":
    main()
