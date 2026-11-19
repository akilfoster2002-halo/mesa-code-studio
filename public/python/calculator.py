# My Calculator  /  Mi calculadora
# A line that starts with # is a comment. Python skips it.

history = []                     # a list: it remembers every answer


def calculate(a, sign, b):       # a function: a job with a name
    if sign == "+":
        return a + b
    elif sign == "-":
        return a - b
    elif sign == "*":
        return a * b
    elif sign == "/":
        if b == 0:
            return "Error: you can't divide by 0"
        return a / b
    else:
        return "Error: I don't know that sign"


print("=== My Calculator ===")
name = input("What is your name? ")
print(f"Hi {name}! Let's do math.")

again = "yes"
while again == "yes":            # a loop: repeat while the answer is yes
    try:
        a = float(input("First number: "))
        sign = input("Sign (+  -  *  /): ")
        b = float(input("Second number: "))
        answer = calculate(a, sign, b)
        print(f"{a} {sign} {b} = {answer}")
        history.append(answer)
    except ValueError:
        print("Oops! That is not a number.")
    again = input("Again? (yes/no): ").lower()

print(f"You did {len(history)} problems:")
for answer in history:
    print(answer)
print(f"Bye, {name}!")
