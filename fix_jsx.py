filepath = 'src/modules/commercial/CommercialModule.jsx'

with open(filepath, 'rb') as f:
    content = f.read()

# Find the problematic section and wrap with a Fragment
old = (
    b'      {activeListTab === \'quote\' && (\r\n'
    b'        <div style={{ display: \'flex\', justifyContent: \'flex-end\', marginBottom: \'1rem\', gap: \'0.5rem\' }}>'
)

new = (
    b'      {activeListTab === \'quote\' && (\r\n'
    b'        <>\r\n'
    b'        <div style={{ display: \'flex\', justifyContent: \'flex-end\', marginBottom: \'1rem\', gap: \'0.5rem\' }}>'
)

if old in content:
    content = content.replace(old, new, 1)
    print("Step 1: Fragment opening added")
else:
    print("Step 1: pattern NOT FOUND")
    print("Searching for activeListTab quote...")
    idx = content.find(b"activeListTab === 'quote'")
    if idx != -1:
        print(repr(content[idx:idx+200]))

# Now find the closing of the quote block - it ends with )}\n\n
# after the last </div> of the quote section which closes the outer <div>
# We need to close the Fragment before the )}

# Find: "\n      )}\n\n\n      {/* Consumables Tab */}"
old2 = b'\r\n      )}\r\n\r\n\r\n      {/* Consumables Tab'
new2 = b'\r\n        </>\r\n      )}\r\n\r\n\r\n      {/* Consumables Tab'

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Step 2: Fragment closing added")
else:
    print("Step 2: pattern NOT FOUND")
    idx = content.find(b'Consumables Tab')
    if idx != -1:
        print(repr(content[max(0,idx-100):idx+50]))

with open(filepath, 'wb') as f:
    f.write(content)

print("Done.")
