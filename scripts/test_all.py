#!/usr/bin/env python3
"""Run all automated test suites across the Horizon platform."""

import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]

SUITES = [
    ("Backend API (apps/api)", ["python", "-m", "pytest", "tests", "-v"], ROOT_DIR / "apps" / "api"),
    ("AI Service (services/ai)", ["python", "-m", "pytest", "tests", "-v"], ROOT_DIR / "services" / "ai"),
]


def main():
    print("==================================================")
    print("HORIZON MONOREPO TEST RUNNER")
    print("==================================================\n")
    all_passed = True

    for name, cmd, cwd in SUITES:
        print(f"--> Running {name}...")
        res = subprocess.run(cmd, cwd=cwd)
        if res.returncode != 0:
            print(f"[FAIL] {name} tests failed!\n")
            all_passed = False
        else:
            print(f"[PASS] {name} tests succeeded!\n")

    if all_passed:
        print("==================================================")
        print("ALL TEST SUITES PASSED!")
        print("==================================================")
        sys.exit(0)
    else:
        print("==================================================")
        print("SOME TESTS FAILED!")
        print("==================================================")
        sys.exit(1)


if __name__ == "__main__":
    main()
