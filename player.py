from io import BytesIO
import random
import string
import sys
import argparse
from huggingface_hub import HfApi

parser = argparse.ArgumentParser(description="创建音乐播放器空间")
parser.add_argument(
    "--token",
    type=str,
    required=True,
    help="HuggingFace Token，需要写权限",
    default="",
)
parser.add_argument("--image", help="播放器 docker 镜像地址", default="")

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
    # 检查 token
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

    # 镜像
    image = "ghcr.io/zxlwqa/player:latest"
    if args.image.strip():
        image = args.image.strip()

    # 随机空间名
    space_name = generate_random_string(2)
    repoid = f"{userid}/{space_name}"

    # README 内容
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

    # 创建空间
    api.create_repo(
        repo_id=repoid,
        repo_type="space",
        space_sdk="docker",
    )

    # 上传 README.md
    api.upload_file(
        repo_id=repoid,
        path_in_repo="README.md",
        path_or_fileobj=readme_obj,
        repo_type="space",
    )

    # 上传 Dockerfile
    dockerfile_content = f"FROM {image}"
    api.upload_file(
        repo_id=repoid,
        path_in_repo="Dockerfile",
        path_or_fileobj=BytesIO(dockerfile_content.encode("utf-8")),
        repo_type="space",
    )

    print(f"✅ 已在 Hugging Face 创建播放器 Space：{repoid}")
