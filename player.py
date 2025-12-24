from io import BytesIO
import random
import string
import sys
import argparse
from huggingface_hub import HfApi

parser = argparse.ArgumentParser(description="创建音乐播放器空间")
parser.add_argument("--token", type=str, required=True, help="HuggingFace Token，需要写权限", default="")
parser.add_argument("--image", help="Docker镜像地址", default="")
parser.add_argument("--account-id", help="Cloudflare账户ID", default="")
parser.add_argument("--access-key-id", help="R2访问密钥ID", default="")
parser.add_argument("--secret-access-key", help="R2秘密访问密钥", default="")
parser.add_argument("--git-repo", help="GitHub仓库名", default="")
parser.add_argument("--git-token", help="GitHub Token", default="")
parser.add_argument("--git-url", help="GitHub 代理URL", default="")
parser.add_argument("--git-path", help="GitHub仓库中音乐文件夹路径", default="")
parser.add_argument("--webdav-url", help="WebDAV地址", default="")
parser.add_argument("--webdav-user", help="WebDAV用户名", default="")
parser.add_argument("--webdav-pass", help="WebDAV密码", default="")
parser.add_argument("--webdav-path", help="WebDAV云盘中音乐文件夹路径", default="")
parser.add_argument("--password", help="管理密码", default="")

args = parser.parse_args()


def generate_random_string(length=10):
    """生成至少包含一个字母的随机字符串"""
    if length < 1:
        return ""
    chars = string.ascii_letters + string.digits
    mandatory_letter = random.choice(string.ascii_letters)
    remaining_chars = random.choices(chars, k=length - 1)
    full_chars = remaining_chars + [mandatory_letter]
    random.shuffle(full_chars)
    return "".join(full_chars)


if __name__ == "__main__":
    token = args.token.strip()
    if not token:
        print("Token 不能为空")
        sys.exit(1)

    api = HfApi(token=token)
    user_info = api.whoami()
    if not user_info.get("name"):
        print("未获取到用户名信息，程序退出。")
        sys.exit(1)

    userid = user_info.get("name")

    image = "ghcr.io/zxlwq/player:latest"
    if args.image.strip():
        image = args.image.strip()

    space_name = generate_random_string(2)
    repoid = f"{userid}/{space_name}"

    readme_content = f"""
---
title: {space_name}
emoji: 🎵
colorFrom: pink
colorTo: purple
sdk: docker
app_port: 3000
pinned: false
---
"""

    readme_obj = BytesIO(readme_content.encode("utf-8"))

    secrets = [
        {"key": "GIT_REPO", "value": args.git_repo or ""},
        {"key": "GIT_TOKEN", "value": args.git_token or ""},
        {"key": "GIT_URL", "value": args.git_url or ""},
        {"key": "GIT_PATH", "value": args.git_path or ""},
        {"key": "PASSWORD", "value": args.password or ""},
        {"key": "WEBDAV_URL", "value": args.webdav_url or ""},
        {"key": "WEBDAV_USER", "value": args.webdav_user or ""},
        {"key": "WEBDAV_PASS", "value": args.webdav_pass or ""},
        {"key": "WEBDAV_PATH", "value": args.webdav_path or ""},
        {"key": "ACCOUNT_ID", "value": args.account_id or ""},
        {"key": "ACCESS_KEY_ID", "value": args.access_key_id or ""},
        {"key": "SECRET_ACCESS_KEY", "value": args.secret_access_key or ""},
    ]

    api.create_repo(
        repo_id=repoid,
        repo_type="space",
        space_sdk="docker",
        space_secrets=secrets,
    )

    api.upload_file(
        repo_id=repoid,
        path_in_repo="README.md",
        path_or_fileobj=readme_obj,
        repo_type="space",
    )

    dockerfile_content = f"FROM {image}\n"
    api.upload_file(
        repo_id=repoid,
        path_in_repo="Dockerfile",
        path_or_fileobj=BytesIO(dockerfile_content.encode("utf-8")),
        repo_type="space",
    )

    print(f"✅ 创建Space成功：{repoid}")
