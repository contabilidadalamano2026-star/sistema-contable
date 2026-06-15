import sys
import os

# Agregamos la ruta actual al path para que Python encuentre los modulos (db, api, mac, etc.)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_v2 import app
