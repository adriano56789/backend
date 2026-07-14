import os, time, re

assets_dir = '/var/www/livego.store/assets'
html_file = '/var/www/livego.store/index.html'

# Find the new JS file that was created
files = [f for f in os.listdir(assets_dir) if f.startswith('index-') and f.endswith('.js') and f != 'index-CFGsS_wl.js' and f != 'index-IrGMH29A.js']
if not files:
    # Create a new name
    new_name = 'index-' + str(int(time.time())) + '.js'
    os.rename(os.path.join(assets_dir, 'index-CFGsS_wl.js'), os.path.join(assets_dir, new_name))
else:
    new_name = files[0]

print('Using:', new_name)

with open(html_file, 'r') as f:
    html = f.read()

# Fix any broken references
html = re.sub(r'src="\./assets/\$?NEWNAME"', f'src="./assets/{new_name}"', html)
html = re.sub(r'src="\./assets/\$NEWNAME"', f'src="./assets/{new_name}"', html)

# Remove old script tag if present and add correct one
if f'index-CFGsS_wl.js' in html or '$NEWNAME' in html:
    html = re.sub(
        r'<script type="module".*?></script>',
        f'<script type="module" crossorigin src="./assets/{new_name}"></script>',
        html
    )

with open(html_file, 'w') as f:
    f.write(html)

print('Fixed HTML references to', new_name)

# Ensure assets dir has correct permissions
os.chmod(assets_dir, 0o755)
for f in os.listdir(assets_dir):
    os.chmod(os.path.join(assets_dir, f), 0o644)

print('Permissions fixed')
