#!/usr/bin/env python
"""Script to run alembic migrations avoiding local alembic directory shadowing."""

import sys
import os

# Remove backend directory from path to avoid shadowing
sys.path = [p for p in sys.path if 'backend' not in p.lower() or 'site-packages' in p.lower()]

# Add site-packages explicitly
venv_site_packages = os.path.join(os.path.dirname(sys.executable), '..', 'Lib', 'site-packages')
sys.path.insert(0, os.path.abspath(venv_site_packages))

# Now import alembic from site-packages
from alembic import command
from alembic.config import Config

# Change to backend directory for alembic.ini
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Run migrations
cfg = Config('alembic.ini')
command.upgrade(cfg, 'head')
print("Migrations applied successfully!")
