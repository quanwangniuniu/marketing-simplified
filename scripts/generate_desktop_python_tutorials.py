#!/usr/bin/env python3
"""Generate Jupyter tutorial notebooks on the user's Desktop (MediaJira learning path)."""
import json
from pathlib import Path

DESKTOP = Path.home() / "Desktop" / "MediaJira_Python_教程"
BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"


def lines(s: str):
    if not s:
        return ["\n"]
    parts = s.splitlines(keepends=True)
    return parts if parts else ["\n"]


def md(s: str):
    return {"cell_type": "markdown", "metadata": {}, "source": lines(s)}


def code(s: str):
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": lines(s),
    }


def save(name: str, cells: list) -> None:
    doc = {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "pygments_lexer": "ipython3"},
        },
        "cells": cells,
    }
    p = DESKTOP / name
    p.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", p)


def main() -> None:
    DESKTOP.mkdir(parents=True, exist_ok=True)
    br = str(BACKEND_ROOT)

    cells1 = [
        md(
            """# Python 基础语法（循序渐进）

本笔记本适合「从零跟敲」。每个代码块都可单独运行。与 **MediaJira** 后端技术栈一致：项目使用 **Python 3** + **Django 4.2**。"""
        ),
        md(
            """## 1. 变量与基本类型

Python 是动态类型语言：名字绑定到对象，用 `type()` 查看类型。"""
        ),
        code(
            """# 数字与布尔
count = 42
ratio = 3.14
ok = True

print(count, type(count))
print(ratio, type(ratio))
print(ok, type(ok))"""
        ),
        code(
            """# 字符串：单引号/双引号等价；三引号可多行
name = "MediaJira"
multiline = '''第一行
第二行'''
print(name, len(name))
print(multiline)"""
        ),
        md(
            """## 2. 字符串常用操作

格式化推荐 **f-string**（Python 3.6+），可读性最好。"""
        ),
        code(
            """project = "spreadsheet"
rows = 100

# f-string：花括号内可以是表达式
msg = f"加载 {project!r}，约 {rows * 2} 个单元格"
print(msg)

# split / strip：处理用户输入、CSV 时很常见
raw = "  a, b , c  "
parts = [p.strip() for p in raw.split(",")]
print(parts)"""
        ),
        md(
            """## 3. 列表 list

有序、可变；项目里常用来装「行」「ID 列表」等。"""
        ),
        code(
            """nums = [1, 2, 3]
nums.append(4)          # 尾部追加
nums.insert(0, 0)       # 指定位置插入
last = nums.pop()       # 弹出尾部

print(nums, "popped:", last)

# 切片：左闭右开
print(nums[1:3])      # 索引 1,2
print(nums[-2:])       # 倒数两个"""
        ),
        md(
            """## 4. 元组 tuple 与解包

元组不可变；常用于函数返回多个值。"""
        ),
        code(
            """point = (10, 20)
x, y = point          # 解包
print(x, y)

# 单元素元组注意逗号
single = (42,)
print(single, type(single))"""
        ),
        md(
            """## 5. 字典 dict

键值对；JSON 与 DRF `Response` 里大量使用「字典形态」的数据。"""
        ),
        code(
            """user = {"id": 1, "name": "Ada", "roles": ["editor"]}

# 安全读取：没有键时给默认值（避免 KeyError）
role = user.get("role", "guest")
print(role)

# 遍历键、值
for key, value in user.items():
    print(key, "->", value)"""
        ),
        md(
            """## 6. 集合 set

去重、成员测试 O(1) 平均；适合「已选列 ID」等场景。"""
        ),
        code(
            """a = {1, 2, 3}
b = {3, 4, 5}
print("并集", a | b)
print("交集", a & b)

# 从列表去重（顺序不保证；要保序可用 dict.fromkeys）
print(list({1, 1, 2, 2, 3}))"""
        ),
        md(
            """## 7. if / elif / else 与比较

注意：`==` 比较值，`is` 比较是否是同一对象（少用 `is` 比较字面量）。"""
        ),
        code(
            """def grade(score: int) -> str:
    if score >= 90:
        return "A"
    elif score >= 60:
        return "B"
    else:
        return "C"

print(grade(95), grade(70), grade(40))

# 成员测试：in
print("spreadsheet" in ["task", "spreadsheet", "decision"])"""
        ),
        md(
            """## 8. for / while 循环

`range` 生成整数序列；`enumerate` 同时拿索引和元素。"""
        ),
        code(
            """for i in range(3):
    print("i =", i)

items = ["a", "b", "c"]
for idx, val in enumerate(items, start=1):
    print(idx, val)

# while：注意避免死循环
n = 3
while n > 0:
    print(n)
    n -= 1"""
        ),
        md(
            """## 9. 函数定义与返回值

使用 **类型注解**（后面笔记本会展开）能让 IDE 与队友更省心。"""
        ),
        code(
            """def add(a: int, b: int) -> int:
    return a + b

def greet(name: str, shout: bool = False) -> str:
    msg = f"Hello, {name}"
    return msg.upper() if shout else msg

print(add(2, 3))
print(greet("team"))
print(greet("team", shout=True))"""
        ),
        md(
            """## 10. 模块与 import

同一项目里你会看到：`from .services import SpreadsheetService`（相对导入，在包内）。"""
        ),
        code(
            """import math
from math import sqrt

print(math.pi)
print(sqrt(16))

# 仅作演示：从标准库导入常用工具
from pathlib import Path
p = Path(".")
print("当前目录是否存在:", p.exists())"""
        ),
        md(
            """## 小结

掌握：基本类型、容器（list/dict/set）、控制流、函数、导入。下一本笔记本会讲 **推导式、生成器、上下文管理器** 等进阶写法。"""
        ),
    ]
    save("01_Python_基础语法.ipynb", cells1)

    cells2 = [
        md(
            """# Python 进阶语法与常用写法

假设你已熟悉「01 基础语法」。这里贴近后端日常：数据处理、可读性、少写样板代码。"""
        ),
        md(
            """## 1. 列表 / 字典 / 集合推导式

一行构建新容器；注意：**不要为了炫技写超长一行**。"""
        ),
        code(
            """# 列表推导：[expr for x in iterable if cond]
squares = [n * n for n in range(5)]
print(squares)

# 字典推导
names = ["alice", "bob"]
upper_map = {n: n.upper() for n in names}
print(upper_map)

# 集合推导
chars = {c.lower() for c in "Hello"}
print(chars)"""
        ),
        md(
            """## 2. 生成器表达式与惰性

大数据量时用生成器，避免一次性占满内存。"""
        ),
        code(
            """# 圆括号 -> 生成器表达式（惰性）
it = (n * n for n in range(10_000_000))
print(next(it), next(it))  # 按需取

# 与 sum 等配合：不会先构建巨大列表
total = sum(n for n in range(5))
print(total)"""
        ),
        md(
            """## 3. 解包：`*` 与 `**`

`*` 展开序列，`**` 展开映射；调用函数、合并字典时常用。"""
        ),
        code(
            """def move(x, y, z):
    return x + y + z

coords = [1, 2, 3]
print(move(*coords))  # 等价 move(1,2,3)

defaults = {"a": 1, "b": 2}
overrides = {"b": 9}
merged = {**defaults, **overrides}
print(merged)"""
        ),
        md(
            """## 4. `*args` 与 `**kwargs`

可变参数；Django/DRF 里装饰器、信号回调会见到类似模式。"""
        ),
        code(
            """def log_call(*args, **kwargs):
    print("args:", args)
    print("kwargs:", kwargs)

log_call(1, 2, name="sheet", rows=10)"""
        ),
        md(
            """## 5. 匿名函数与 `sorted` 的 `key`

排序、去重前的「临时规则」用 `lambda` 很合适。"""
        ),
        code(
            """rows = [
    {"id": 2, "title": "B"},
    {"id": 1, "title": "A"},
]
sorted_rows = sorted(rows, key=lambda r: r["id"])
print(sorted_rows)"""
        ),
        md(
            """## 6. `enumerate` / `zip`

并行遍历多个序列时很常用。"""
        ),
        code(
            """headers = ["A", "B", "C"]
values = [10, 20, 30]

for h, v in zip(headers, values):
    print(h, v)

for i, h in enumerate(headers):
    print(i, h)"""
        ),
        md(
            """## 7. 上下文管理器 `with`

自动关闭文件、释放锁。项目里 ORM 事务常用 `with transaction.atomic():`（下一本 Django 笔记本会呼应）。"""
        ),
        code(
            """from contextlib import contextmanager

@contextmanager
def tag(name):
    print(f"<{name}>")
    yield
    print(f"</{name}>")

with tag("div"):
    print("content")"""
        ),
        md(
            """## 8. 装饰器入门（概念）

装饰器是「接收函数、返回函数」的高阶函数。Django 里 `@login_required`、`@method_decorator` 都是这一类。"""
        ),
        code(
            """def bold(fn):
    def wrapper(*args, **kwargs):
        return "**" + str(fn(*args, **kwargs)) + "**"
    return wrapper

@bold
def title():
    return "Spreadsheet"

print(title())"""
        ),
        md(
            """## 9. `match` / `case`（Python 3.10+）

对「多种形态」的分支，比长串 `if/elif` 更清晰。"""
        ),
        code(
            """def describe(obj):
    match obj:
        case {"type": "sheet", "id": sid}:
            return f"sheet {sid}"
        case ["cell", r, c]:
            return f"cell {r},{c}"
        case _:
            return "unknown"

print(describe({"type": "sheet", "id": 5}))
print(describe(["cell", 1, 2]))
print(describe(123))"""
        ),
        md(
            """## 10. 海象运算符 `:=`（Python 3.8+）

在表达式里赋值，减少重复计算。"""
        ),
        code(
            """import re

text = "id=42"
if (m := re.search(r"id=(\\d+)", text)):
    print("found:", m.group(1))
else:
    print("not found")"""
        ),
        md(
            """## 小结

进阶重点：**推导式与生成器、* / ** 解包、上下文管理器、装饰器思想、match-case**。下一本：面向对象、`dataclass`、异常与自定义类型。"""
        ),
    ]
    save("02_Python_进阶语法与惯用法.ipynb", cells2)

    cells3 = [
        md(
            """# 面向对象、标准库精粹与错误处理

后端代码大量用「类」组织：`APIView`、`Model`、`Service` 等。本笔记把类、继承、`dataclass`、异常串起来。"""
        ),
        md("""## 1. 简单类与实例属性"""),
        code(
            """class Greeter:
    def __init__(self, who: str) -> None:
        self.who = who

    def hello(self) -> str:
        return f"Hello, {self.who}"

g = Greeter("Django")
print(g.hello())"""
        ),
        md(
            """## 2. 类属性 vs 实例属性

类属性被所有实例共享；要小心可变对象（如 list）作为类属性。"""
        ),
        code(
            """class Counter:
    kind = "metric"  # 类属性

    def __init__(self) -> None:
        self.n = 0  # 实例属性

    def inc(self) -> None:
        self.n += 1

a = Counter()
b = Counter()
a.inc()
print(a.n, b.n, Counter.kind)"""
        ),
        md(
            """## 3. 继承与方法解析

子类可重写方法；`super()` 调用父类实现。"""
        ),
        code(
            """class BaseService:
    def run(self) -> str:
        return "base"

class SheetService(BaseService):
    def run(self) -> str:
        return super().run() + " + sheet"

print(SheetService().run())"""
        ),
        md(
            """## 4. `@dataclass`（Python 3.7+）

少写样板 `__init__`；适合 **DTO**、配置、只读数据结构。"""
        ),
        code(
            """from dataclasses import dataclass, field
from typing import List

@dataclass
class CellRef:
    row: int
    col: int
    tags: List[str] = field(default_factory=list)

c = CellRef(1, 2)
c.tags.append("bold")
print(c)"""
        ),
        md(
            """## 5. 特殊方法浅尝：`__repr__`

调试时打印对象更清晰；生产代码里模型也常自定义表示形式。"""
        ),
        code(
            """class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def __repr__(self) -> str:
        return f"Point({self.x}, {self.y})"

print(Point(1, 2))"""
        ),
        md(
            """## 6. 异常：try / except / else / finally

**捕获具体异常**，避免裸 `except:`。DRF 会把业务错误转成 HTTP 状态码。"""
        ),
        code(
            """def parse_int(s: str) -> int:
    try:
        value = int(s)
    except ValueError as e:
        raise ValueError(f"not an int: {s!r}") from e
    else:
        return value

print(parse_int("42"))
try:
    parse_int("x")
except ValueError as e:
    print("handled:", e)"""
        ),
        md(
            """## 7. 自定义异常

业务里区分「参数不合法」「无权限」「未找到」等，便于视图层映射。"""
        ),
        code(
            """class DomainError(Exception):
    pass  # 业务域错误基类


class NotFoundError(DomainError):
    pass


def load(pk: int):
    if pk <= 0:
        raise NotFoundError("invalid id")
    return {"id": pk}


try:
    load(0)
except NotFoundError as e:
    print("map to 404 in API:", e)"""
        ),
        md(
            """## 8. `collections`：defaultdict / Counter

处理分组、计数时代码更短。"""
        ),
        code(
            """from collections import defaultdict, Counter

by_project = defaultdict(list)
by_project["p1"].append("sheet-a")
by_project["p1"].append("sheet-b")
print(dict(by_project))

print(Counter(["a", "b", "a"]))"""
        ),
        md(
            """## 9. `pathlib.Path`

读写路径时优先用 `Path`，比字符串拼接路径更安全。"""
        ),
        code(
            """from pathlib import Path

root = Path("/tmp") / "mediajira" / "exports"
print(root.name, root.parent)

# 演示：不真的创建目录也可看拼接结果
print(str(root))"""
        ),
        md(
            """## 10. 抽象思想：协议（duck typing）

Python 不强制接口；只要对象有 `.read()` 就像「文件对象」。理解这一点有助于读第三方库源码。"""
        ),
        code(
            """class InMemoryFile:
    def __init__(self, data: bytes) -> None:
        self._data = data

    def read(self) -> bytes:
        return self._data

f = InMemoryFile(b"hello")
print(f.read())"""
        ),
        md(
            """## 小结

**类与继承、`dataclass`、异常体系、`collections` 与 `Path`** 是读 MediaJira `services.py` / `models.py` 时的常见积木。下一本：类型提示、`pytest` 风格断言、日志。"""
        ),
    ]
    save("03_面向对象与错误处理.ipynb", cells3)

    cells4 = [
        md(
            """# 工程化常用：`typing`、迭代工具、日志与测试入门

与团队协作、读大型后端仓库时，这些出现频率很高。"""
        ),
        md(
            """## 1. 类型提示：`Optional` / `Union` / `list[str]`

Python 3.9+ 可用内置泛型 `list[str]`；旧写法是 `List[str]`（`typing`）。"""
        ),
        code(
            """from __future__ import annotations

from typing import Optional

def find_user(user_id: int) -> Optional[dict]:
    if user_id < 0:
        return None
    return {"id": user_id}

print(find_user(1))
print(find_user(-1))"""
        ),
        md(
            """## 2. `TypedDict`：给「字典结构」起名字

适合表示 JSON 负载的静态形状（IDE 友好）。"""
        ),
        code(
            """from typing import TypedDict

class SheetPayload(TypedDict):
    name: str
    rows: int

p: SheetPayload = {"name": "Q1", "rows": 100}
print(p["name"])"""
        ),
        md(
            """## 3. `Protocol`（结构化子类型）

描述「只要有这些方法就行」，不必继承。"""
        ),
        code(
            """from typing import Protocol

class Serializable(Protocol):
    def to_json(self) -> str: ...

class Row:
    def to_json(self) -> str:
        return "{}"

def dump(x: Serializable) -> str:
    return x.to_json()

print(dump(Row()))"""
        ),
        md(
            """## 4. `itertools`：分组与窗口

处理分页、滑动窗口、笛卡尔积时很实用。"""
        ),
        code(
            """from itertools import groupby

data = [{"project": "A", "v": 1}, {"project": "A", "v": 2}, {"project": "B", "v": 3}]
data.sort(key=lambda x: x["project"])

for key, group in groupby(data, key=lambda x: x["project"]):
    print(key, list(group))"""
        ),
        md(
            """## 5. `functools.partial`：固定部分参数

给回调、服务方法「预设」依赖时常用。"""
        ),
        code(
            """from functools import partial

def export(fmt: str, name: str) -> str:
    return f"{name}.{fmt}"

pdf_export = partial(export, "pdf")
print(pdf_export("report"))"""
        ),
        md(
            """## 6. 日志 `logging`（项目里常见）

与 `print` 相比：级别、格式、输出目标都可控。MediaJira 视图模块里常见 `logger = logging.getLogger(__name__)`。"""
        ),
        code(
            """import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

log.debug("调试信息通常不显示")
log.info("请求处理开始")
log.warning("慢一点但还能用")"""
        ),
        md(
            """## 7. 断言与「快速失败」

`assert` 用于**开发期不变量**；不要用 assert 校验用户输入（可能被优化掉）。"""
        ),
        code(
            """def divide(a: float, b: float) -> float:
    assert b != 0, "b must not be zero"
    return a / b

print(divide(10, 2))"""
        ),
        md(
            """## 8. `pytest` 风格测试（概念演示）

项目用 `pytest`。测试函数名以 `test_` 开头，用普通 `assert`。"""
        ),
        code(
            """def test_add():
    assert 1 + 1 == 2

# 在 notebook 里直接调用演示（真实项目用 pytest 运行）
test_add()
print("test_add passed")"""
        ),
        md(
            """## 9. `unittest.mock` 思想：替身依赖

测服务时，把 I/O、外部 API 换成假实现，只测业务分支。"""
        ),
        code(
            """from unittest.mock import Mock

api = Mock()
api.fetch.return_value = {"ok": True}

print(api.fetch())
api.fetch.assert_called_once()"""
        ),
        md(
            """## 10. 小结

把 **类型提示、迭代与工具函数、logging、pytest + mock** 当作日常装备。下一本笔记本对照 **MediaJira**：Django 项目布局、DRF 视图与「瘦视图 + 服务层」。"""
        ),
    ]
    save("04_工程化typing日志与测试.ipynb", cells4)

    cells5 = [
        md(
            f"""# Django + DRF 与 MediaJira 后端架构（对照学习）

项目根目录下 **`backend/`** 使用 **Django 4.2** + **Django REST framework 3.14** + **Celery** + **Channels**。

团队约定（摘自仓库规则）：
- **视图要薄**：解析输入、权限、调用 **service**、返回响应。
- **序列化器**：校验与规范化；副作用尽量不放这里。
- **服务层**：核心业务写在 `services.py`。"""
        ),
        md(
            """## 1. Django 项目里常见的目录

```
backend/
  manage.py
  backend/          # 项目包：settings、urls、wsgi、asgi
  spreadsheet/      # 业务应用：models、views、serializers、services、urls
  ...
```

你在 `spreadsheet/views.py` 里会看到：`APIView` + `IsAuthenticated` + 调用 `SpreadsheetService` 等。"""
        ),
        md(
            """## 2. 在 Notebook 中 `django.setup()`（可选）

下面单元格会把仓库的 `backend` 目录加入 `sys.path` 并初始化 Django。**若缺少依赖或环境变量**，可能报错；那时可在项目虚拟环境里安装依赖后再试。

路径由生成脚本根据本机仓库自动写入 `BACKEND_ROOT`。"""
        ),
        code(
            f"""import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(r"{br}")

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

import django  # noqa: E402

django.setup()

import django as dj

print("Django version:", dj.get_version())"""
        ),
        md(
            """## 3. ORM 心智模型（不连库也可理解）

- **Model** 类 ↔ 数据表的一行/schema。
- **QuerySet** 是惰性查询：真正访问数据时才 hit DB。
- 性能：**`select_related`**（外键 JOIN）、**`prefetch_related`**（反查批量预取）缓解 N+1。"""
        ),
        code(
            """# 纯 Python 演示「惰性」：类似 QuerySet 直到需要时才计算

class LazySquares:
    def __init__(self, n: int) -> None:
        self.n = n

    def __iter__(self):
        for i in range(self.n):
            yield i * i

# 没有「立即算出全部列表」
it = LazySquares(5)
print("first:", next(iter(it)))"""
        ),
        md(
            """## 4. DRF：`APIView` 与 `Response`

视图类写 `get` / `post`；返回 `Response(data, status=...)`。项目里大量使用 `rest_framework.views.APIView`。"""
        ),
        code(
            """# 不运行 Django，仅用类型注释演示「瘦视图」形状

from typing import Any, Tuple

def handle_list(query: dict[str, Any]) -> Tuple[dict[str, Any], int]:
    # 真实代码里这里会调 service + ORM
    return {"items": [], "page": int(query.get("page", 1))}, 200

body, status = handle_list({"page": "2"})
print(status, body)"""
        ),
        md(
            """## 5. 序列化：校验 → 干净数据

DRF Serializer 类似「表单 + 转换器」。项目里 `SpreadsheetCreateSerializer` 等负责入参形状。"""
        ),
        code(
            """from dataclasses import dataclass

@dataclass
class SimpleSerializer:
    # 玩具级：演示 validate -> validated_data
    def validate(self, data: dict) -> dict:
        name = data.get("name")
        if not name:
            raise ValueError("name required")
        return {"name": name.strip()}

print(SimpleSerializer().validate({"name": "  abc  "}))"""
        ),
        md(
            """## 6. 服务层：把分支逻辑收拢

读 `spreadsheet/services.py` 时，把「一个用例」想成 **一个服务方法**：入参明确、返回值明确、异常语义清楚。"""
        ),
        code(
            """class SpreadsheetServiceToy:
    @staticmethod
    def rename(spreadsheet_id: int, new_name: str) -> dict:
        if spreadsheet_id <= 0:
            raise ValueError("invalid id")
        if not new_name.strip():
            raise ValueError("empty name")
        return {"id": spreadsheet_id, "name": new_name.strip()}

print(SpreadsheetServiceToy.rename(1, "  FY2026  "))"""
        ),
        md(
            """## 7. 事务：`transaction.atomic`

多步写库要同事务：要么全成功，要么全回滚。后端规则里强调这一点。"""
        ),
        code(
            """# 概念演示（不访问真实 DB）

class Rollback(Exception):
    pass


def atomic_demo(ok: bool) -> str:
    steps = []
    steps.append("begin")
    try:
        steps.append("write A")
        if not ok:
            raise Rollback("failed B")
        steps.append("write B")
    except Rollback:
        steps.append("rollback all")
        return " -> ".join(steps)
    steps.append("commit")
    return " -> ".join(steps)


print(atomic_demo(True))
print(atomic_demo(False))"""
        ),
        md(
            """## 8. Celery：异步任务（概念）

`spreadsheet/views.py` 中有 `from .tasks import apply_pattern_job`。典型模式：**视图快速返回**，重活丢到 worker。"""
        ),
        code(
            """# 用普通函数模拟「异步任务入口」

def apply_pattern_job(job_id: int) -> str:
    return f"heavy work for job {job_id} queued/done"

print(apply_pattern_job(42))"""
        ),
        md(
            """## 9. JWT 与 CSRF（仓库注意事项）

JWT 前端通常不带 CSRF token；若浏览器里同时登录了 Django Admin，POST 可能遇到 CSRF 403。规则里提到对特定视图使用 `@csrf_exempt` + `method_decorator`。**安全边界要以团队文档为准**。"""
        ),
        md(
            """## 小结

对照阅读顺序建议：`urls.py` → `views.py` → `serializers.py` → `services.py` → `models.py`。下一本：SQL 思维、并发与小结练习。"""
        ),
    ]
    save("05_Django_DRF与MediaJira架构.ipynb", cells5)

    cells6 = [
        md(
            """# SQL 思维、并发与「后端常见坑」（巩固）

不替代数据库课；目标是读 Django ORM 生成的 SQL、写安全查询时有方向。"""
        ),
        md(
            """## 1. 关系：一对多 / 多对多（ORM 词汇）

- **ForeignKey**：多对一（多行子表指向同一父行）。
- **ManyToMany**：通过中间表；批量操作要注意性能。"""
        ),
        code(
            """# 用字典模拟「外键」

projects = {1: {"name": "P1"}}
sheets = {10: {"project_id": 1, "title": "S1"}}

sid = 10
pid = sheets[sid]["project_id"]
print(sheets[sid]["title"], "belongs to", projects[pid]["name"])"""
        ),
        md(
            """## 2. 索引直觉：WHERE / JOIN / ORDER BY

有索引的列过滤更快；全表扫描在大表上会很慢。迁移里加索引是常见优化手段。"""
        ),
        md(
            """## 3. N+1 查询是什么？

取 100 行父记录，又对每行查一次子记录 → 1 + 100 次查询。用 `prefetch_related` 等合并成常数次查询。"""
        ),
        code(
            """# 玩具：naive N+1 vs batch

parents = list(range(3))


def children_for(p):
    return [f"c{p}-1", f"c{p}-2"]


# N+1：每个 parent 一次
all_naive = []
for p in parents:
    all_naive.extend(children_for(p))

# batch 思想：一次取完（真实 ORM 用 prefetch）
print(all_naive)"""
        ),
        md(
            """## 4. 幂等与重试

网络任务可能重复送达；设计 API 时考虑「同一个请求做两次是否安全」。"""
        ),
        code(
            """def create_if_absent(store: set, key: str) -> str:
    if key in store:
        return "noop"
    store.add(key)
    return "created"


seen: set[str] = set()
print(create_if_absent(seen, "job-1"), create_if_absent(seen, "job-1"))"""
        ),
        md(
            """## 5. 并发：GIL 与 I/O

CPython 有 GIL：**CPU 密集**多线程未必加速；**I/O 密集**（请求外部 API、读盘）线程/async 仍有价值。Celery worker 用多进程是常见组合。"""
        ),
        md(
            """## 6. 时区：存 UTC，展示再转

Django 里 `USE_TZ` 与时间字段；报表与导出时要明确时区。"""
        ),
        code(
            """from datetime import datetime, timezone

utc_now = datetime.now(timezone.utc)
print(utc_now.isoformat())"""
        ),
        md(
            """## 7. 小练习：实现「分页切片」

给定 `page`（从 1 开始）与 `page_size`，返回 `items` 的切片。"""
        ),
        code(
            """def paginate(items: list[str], page: int, page_size: int) -> list[str]:
    if page < 1 or page_size < 1:
        raise ValueError("invalid page or page_size")
    start = (page - 1) * page_size
    return items[start : start + page_size]


data = [f"row-{i}" for i in range(25)]
print(paginate(data, 2, 10))"""
        ),
        md(
            """## 8. 小练习：合并单元格更新（字典覆盖）

把 `updates` 里的坐标覆盖到 `grid`。"""
        ),
        code(
            """def apply_updates(
    grid: dict[tuple[int, int], str],
    updates: dict[tuple[int, int], str],
) -> dict[tuple[int, int], str]:
    merged = dict(grid)
    merged.update(updates)
    return merged


g = {(0, 0): "a", (0, 1): "b"}
u = {(0, 1): "B2"}
print(apply_updates(g, u))"""
        ),
        md(
            """## 学完这 6 本笔记本后

建议回到仓库：**挑一个你已理解的接口**，从 `urls.py` 跟到 `views.py`，再跳进 `services.py`，对照模型字段，画一张自己的「数据流」草图。比单纯背语法更有效。"""
        ),
    ]
    save("06_SQL思维并发与巩固练习.ipynb", cells6)

    print("Done. Output dir:", DESKTOP)


if __name__ == "__main__":
    main()
