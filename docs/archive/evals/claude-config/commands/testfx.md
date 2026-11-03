Run the test suite and fix any errors that occur.

Steps:
1. Activate the virtual environment with `source .venv/bin/activate`
2. Run the test suite using `python -m pytest tests/ -v`
3. If any tests fail:
   - Read the relevant test files and source files
   - Analyze the error messages and stack traces
   - Fix the underlying issues in the source code
   - Re-run the tests to verify the fixes
4. Continue until all tests pass
5. Report a summary of what was fixed

Important:
- Always raise exceptions on errors, never silently log them
- Follow type annotations and SOLID principles
- Make focused, incremental changes
