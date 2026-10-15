"""Import only mantis into this site's public directory."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'tools'))
from import_frontend import install

if __name__ == '__main__':
    install('mantis')
