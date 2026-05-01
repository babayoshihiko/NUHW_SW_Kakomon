import re
import json
from pathlib import Path

def parse(text: str):
    lines = text.splitlines()

    data = []
    category = None
    current = None

    question_lines = []
    choices = []
    mode = "idle"

    def flush():
        nonlocal current, question_lines, choices

        if current:
            current["question"] = "\\n".join(question_lines).strip()
            current["wrongs"] = choices
            data.append(current)

        current = None
        question_lines = []
        choices = []
        mode = "idle"

    for line in lines:
        line = line.rstrip()

        # カテゴリ（flushしない！！！）
        m = re.match(r"^##\s*(.+)", line)
        if m:
            category = m.group(1).strip()
            continue

        # 問題開始
        m = re.match(r"^問題\s*([0-9０-９]+)\s*(.*)", line)
        if m:
            flush()  # ←ここだけ

            current = {
                "category": category,
                "question": "",
                "correct": "",
                "wrongs": [],
                "explanation": "",
                "ref": f"問題{m.group(1)}"
            }

            question_lines = []
            choices = []
            mode = "question"

            rest = m.group(2).strip()
            if rest:
                question_lines.append(rest)

            continue

        # 選択肢開始
        m = re.match(r"^\s*1\s+(.*)", line)
        if m and current:
            mode = "choices"
            choices.append(m.group(1).strip())
            continue

        m = re.match(r"^\s*([2-5])\s+(.*)", line)
        if m and current and mode == "choices":
            choices.append(m.group(2).strip())
            continue

        # 空行スキップ
        if not line.strip():
            continue

        # question
        if current and mode == "question":
            question_lines.append(line.strip())

    flush()
    return data


if __name__ == "__main__":
    import sys
    from pathlib import Path
    import json

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else input_path.with_suffix(".json")

    text = input_path.read_text(encoding="utf-8")
    result = parse(text)

    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"✔ saved: {output_path}")
