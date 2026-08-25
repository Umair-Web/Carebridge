with open('d:/Projects/CareBridge/blueprint_text.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('=== SECTIONS FOUND ===')
for i, line in enumerate(lines):
    if line.strip().startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.', '13.', '14.', '15.', '16.', '17.', '18.', '19.', '20.')):
        print(f"Line {i+1}: {line.strip()}")
