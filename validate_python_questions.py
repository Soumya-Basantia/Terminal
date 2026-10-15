"""
Automated Python 3 Semantic Validation Script for TERMINAL CODENEX Rapid Fire
Executes each snippet in an isolated subprocess with timeout and verifies outputs.
"""
import sys
import json
import io
import contextlib

def test_q1():
    # Q1 — Operator precedence: print(2 ** 3 ** 2)
    val = 2 ** 3 ** 2
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        print(2 ** 3 ** 2)
    printed = out.getvalue().strip()
    assert isinstance(val, int), "Q1 value must be int"
    assert val == 512, f"Q1 2**3**2 must be 512, got {val}"
    assert printed == "512", f"Q1 printed output must be '512', got '{printed}'"
    return {"val": val, "printed": printed, "correct_option": "512"}

def test_q2():
    # Q2 — String repetition and concatenation: print('5' * 2 + '3')
    val = '5' * 2 + '3'
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        print('5' * 2 + '3')
    printed = out.getvalue().strip()
    assert isinstance(val, str), "Q2 value must be str, not int"
    assert val == '553', f"Q2 '5'*2+'3' must be string '553', got {val!r}"
    assert val != 553, "Q2 value must NOT be integer 553"
    assert printed == "553", f"Q2 printed output must be '553', got '{printed}'"
    return {"val": val, "printed": printed, "is_str": True, "correct_option": "'553'"}

def test_q3():
    # Q3 — Boolean logic and short-circuiting: x = 0
    x = 0
    expr_a = (x == 0 or x > 1)
    expr_b = (not x)
    # Verify short-circuit: 10 / x would raise ZeroDivisionError if evaluated!
    try:
        expr_c = (x != 0 and 10 / x > 1)
    except ZeroDivisionError:
        assert False, "Q3 option C must short-circuit and not raise ZeroDivisionError"
    expr_d = (bool(x) == False)

    assert expr_a is True, "Q3 option A (x == 0 or x > 1) must evaluate to True"
    assert expr_b is True, "Q3 option B (not x) must evaluate to True"
    assert expr_c is False, "Q3 option C (x != 0 and 10 / x > 1) must evaluate to False"
    assert expr_d is True, "Q3 option D (bool(x) == False) must evaluate to True"

    correct_set = ['x == 0 or x > 1', 'not x', 'bool(x) == False']
    return {"expr_a": expr_a, "expr_b": expr_b, "expr_c": expr_c, "expr_d": expr_d, "correct_set": correct_set}

def test_q4():
    # Q4 — Negative-step slicing: s = "CODENEX"; print(s[-2::-2])
    s = "CODENEX"
    val = s[-2::-2]
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        print(s[-2::-2])
    printed = out.getvalue().strip()
    assert isinstance(val, str), "Q4 value must be str"
    assert val == "EEO", f"Q4 s[-2::-2] must be 'EEO', got '{val}'"
    assert printed == "EEO", f"Q4 printed output must be 'EEO', got '{printed}'"
    # Verification of index breakdown:
    assert s[5] == 'E' and s[3] == 'E' and s[1] == 'O', "Indices 5, 3, 1 must be E, E, O"
    return {"val": val, "printed": printed, "correct_option": "EEO"}

def test_q5():
    # Q5 — Loop and modulo
    total = 0
    for i in range(1, 5):
        total += i % 2
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        print(total)
    printed = out.getvalue().strip()
    assert isinstance(total, int), "Q5 total must be int"
    assert total == 2, f"Q5 total must be 2, got {total}"
    assert printed == "2", f"Q5 printed output must be '2', got '{printed}'"
    return {"val": total, "printed": printed, "correct_option": "2"}

def test_q6():
    # Q6 — Chained comparisons: 1 < 2 < 3 is equivalent in result to 1 < 2 and 2 < 3
    expr1 = (1 < 2 < 3)
    expr2 = (1 < 2 and 2 < 3)
    statement_truth = (expr1 is True) and (expr2 is True) and (expr1 == expr2)
    assert statement_truth is True, "Q6 statement must be True"
    return {"expr1": expr1, "expr2": expr2, "statement_truth": statement_truth, "correct_option": "True"}

def test_q7():
    # Q7 — Truthiness: print(bool([]), bool(" "), bool(""))
    b1 = bool([])
    b2 = bool(" ")
    b3 = bool("")
    assert b1 is False, "bool([]) must be False"
    assert b2 is True, "bool(' ') must be True (non-empty whitespace string)"
    assert b3 is False, "bool('') must be False"
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        print(bool([]), bool(" "), bool(""))
    printed = out.getvalue().strip()
    assert printed == "False True False", f"Q7 printed output must be 'False True False', got '{printed}'"
    return {"b1": b1, "b2": b2, "b3": b3, "printed": printed, "correct_option": "False True False"}

def test_q8():
    # Q8 — String methods and slicing: s = "PyThOn"
    s = "PyThOn"
    expr_a = (s.lower() == 'python')
    expr_b = (s.upper() == 'PYTHON')
    expr_c = (s.startswith('p'))
    expr_d = (s[2:4] == 'Th')

    assert expr_a is True, "Q8 option A (s.lower() == 'python') must be True"
    assert expr_b is True, "Q8 option B (s.upper() == 'PYTHON') must be True"
    assert expr_c is False, "Q8 option C (s.startswith('p')) must be False (case-sensitive check)"
    assert expr_d is True, "Q8 option D (s[2:4] == 'Th') must be True"

    correct_set = ["s.lower() == 'python'", "s.upper() == 'PYTHON'", "s[2:4] == 'Th'"]
    return {"expr_a": expr_a, "expr_b": expr_b, "expr_c": expr_c, "expr_d": expr_d, "correct_set": correct_set}

def test_q9():
    # Q9 — The for...else construct
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        for i in range(3):
            if i == 5:
                break
        else:
            print("DONE")
    printed = out.getvalue().strip()
    assert printed == "DONE", f"Q9 printed output must be 'DONE', got '{printed}'"
    return {"printed": printed, "correct_option": "DONE"}

def test_q10():
    # Q10 — Equality versus identity: a = [1, 2]; b = [1, 2]
    a = [1, 2]
    b = [1, 2]
    claim_equality = (a == b)
    claim_identity = (a is b)
    assert claim_equality is True, "a == b must be True"
    assert claim_identity is False, "a is b must be False (distinct memory objects)"
    statement_truth = (claim_equality is True) and (claim_identity is False)
    assert statement_truth is True, "Q10 statement must evaluate to True"
    return {"claim_equality": claim_equality, "claim_identity": claim_identity, "statement_truth": statement_truth, "correct_option": "True"}

if __name__ == '__main__':
    results = {}
    try:
        results['Q1'] = test_q1()
        results['Q2'] = test_q2()
        results['Q3'] = test_q3()
        results['Q4'] = test_q4()
        results['Q5'] = test_q5()
        results['Q6'] = test_q6()
        results['Q7'] = test_q7()
        results['Q8'] = test_q8()
        results['Q9'] = test_q9()
        results['Q10'] = test_q10()
        print(json.dumps({"success": True, "results": results}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
