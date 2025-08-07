import argparse
import requests
from huggingface_hub import HfApi, CommitOperationAdd

parser = argparse.ArgumentParser()
parser.add_argument("--hf_token", required=True)
parser.add_argument("--hf_user", required=True)
parser.add_argument("--space_name", required=True)
args = parser.parse_args()

api = HfApi()

space_id = f"{args.hf_user}/{args.space_name}"

print(f"创建或确认 Space: {space_id}")
try:
    api.create_repo(
        repo_id=space_id,
        token=args.hf_token,
        repo_type="space",
        space_sdk="docker",  # 指定为 docker 类型 Space
        private=False,
    )
    print("Space 创建成功或已存在")
except Exception as e:
    print(f"创建 Space 异常（可能已存在）：{e}")

# 下载 GitHub 上的 Dockerfile 内容
dockerfile_url = "https://raw.githubusercontent.com/zxlwq/Player/main/Dockerfile"
print(f"下载 Dockerfile: {dockerfile_url}")
r = requests.get(dockerfile_url)
if r.status_code != 200:
    raise RuntimeError(f"下载 Dockerfile 失败，状态码: {r.status_code}")
dockerfile_content = r.content.decode("utf-8")

# 获取 Space 现有 README.md 内容
print("获取当前 README.md 内容")
try:
    readme_content = api.download_file(
        repo_id=space_id,
        filename="README.md",
        repo_type="space",
        token=args.hf_token,
    ).decode("utf-8")
except Exception:
    readme_content = "# Space README\n"

# 追加 app_port: 3000 行（如果不存在）
if "app_port: 3000" not in readme_content:
    if not readme_content.endswith("\n"):
        readme_content += "\n"
    readme_content += "app_port: 3000\n"
    print("追加 app_port: 3000 到 README.md")
else:
    print("README.md 已包含 app_port: 3000")

# 构造提交操作列表
operations = [
    CommitOperationAdd(path_in_repo="Dockerfile", data=dockerfile_content),
    CommitOperationAdd(path_in_repo="README.md", data=readme_content),
]

print("提交 Dockerfile 和 README.md 到 Space")

api.create_commit(
    repo_id=space_id,
    repo_type="space",
    commit_message="🚀 上传 Dockerfile 并追加 app_port 到 README.md",
    token=args.hf_token,
    operations=operations,
)

print("部署完成！")
