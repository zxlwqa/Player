import argparse
import requests
import string
from huggingface_hub import HfApi, CommitOperationAdd
from huggingface_hub.utils import HfHubHTTPError

def get_unused_space_name(hf_user, token):
    api = HfApi(token=token)
    used = [repo.repo_id.split("/")[-1] for repo in api.list_spaces(author=hf_user)]
    for letter in string.ascii_uppercase:
        if letter not in used:
            return letter
    raise Exception("你已用尽 A-Z 的所有 Space 名称，请手动删除一些或指定 space_name。")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf_token", required=True, help="Hugging Face Token")
    parser.add_argument("--hf_user", required=True, help="Hugging Face 用户名")
    args = parser.parse_args()

    hf_token = args.hf_token
    hf_user = args.hf_user

    api = HfApi(token=hf_token)

    space_name = get_unused_space_name(hf_user, hf_token)
    repo_id = f"{hf_user}/{space_name}"

    print(f"创建或确认 Space: {repo_id}")

    try:
        api.create_repo(
            name=space_name,
            token=hf_token,
            repo_type="space",
            space_sdk="docker",
            private=False,
        )
        print("Space 创建成功")
    except HfHubHTTPError as e:
        if "name already exists" in str(e):
            print("Space 已存在，继续...")
        else:
            raise

    # 下载 Dockerfile
    dockerfile_url = "https://raw.githubusercontent.com/zxlwq/Player/main/Dockerfile"
    print(f"下载 Dockerfile: {dockerfile_url}")
    dockerfile_content = requests.get(dockerfile_url).text

    # 获取当前 README.md（如果没有则创建空的）
    try:
        readme = api.hf_hub_download(repo_id=repo_id, filename="README.md", repo_type="space", token=hf_token)
        with open(readme, "r", encoding="utf-8") as f:
            readme_content = f.read()
    except Exception:
        readme_content = ""

    # 添加 app_port: 3000（如果未添加）
    if "app_port:" not in readme_content:
        readme_content += "\napp_port: 3000\n"

    print("提交 Dockerfile 和 README.md 到 Space")

    # 提交文件
    api.create_commit(
        repo_id=repo_id,
        repo_type="space",
        operations=[
            CommitOperationAdd(path_in_repo="Dockerfile", path_or_fileobj=dockerfile_content.encode(), is_bytes=True),
            CommitOperationAdd(path_in_repo="README.md", path_or_fileobj=readme_content.encode(), is_bytes=True),
        ],
        commit_message="Initialize Docker Space with Dockerfile and README",
    )

    print(f"✅ Space 部署完成: https://huggingface.co/spaces/{repo_id}")

if __name__ == "__main__":
    main()
