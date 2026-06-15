import requests
import base64
import json
import logging

# Constantes del Entorno Sandbox (Pruebas)
IDP_URL = "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token"
RECEPCION_URL = "https://api.comprobanteselectronicos.go.cr/recepcion-sandbox/v1/recepcion/"
CLIENT_ID = "api-stag"

def obtener_token(username, password):
    """Obtiene el Bearer token del IDP de Hacienda"""
    data = {
        "grant_type": "password",
        "client_id": CLIENT_ID,
        "username": username,
        "password": password
    }
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    response = requests.post(IDP_URL, data=data, headers=headers)
    if response.status_code != 200:
        logging.error(f"Error obteniendo token: {response.text}")
        raise ValueError("Error de autenticación con Hacienda. Verifica el Usuario y Contraseña ATV.")
        
    return response.json().get("access_token")

def enviar_factura(xml_bytes, clave, emisor_cedula, emisor_tipo, receptor_cedula, receptor_tipo, fecha_emision, token):
    """
    Envuelve el XML firmado en JSON y lo envía al API de Recepción.
    """
    # Codificar XML en Base64
    xml_base64 = base64.b64encode(xml_bytes).decode('utf-8')
    
    # Construir Payload JSON
    payload = {
        "clave": clave,
        "fecha": fecha_emision,
        "emisor": {
            "tipoIdentificacion": emisor_tipo,
            "numeroIdentificacion": emisor_cedula
        },
        "comprobanteXml": xml_base64
    }
    
    if receptor_cedula:
        payload["receptor"] = {
            "tipoIdentificacion": receptor_tipo,
            "numeroIdentificacion": receptor_cedula
        }
        
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(RECEPCION_URL, json=payload, headers=headers)
    
    if response.status_code == 202:
        # Aceptado para procesamiento (es asíncrono)
        return {
            "status": "procesando",
            "location": response.headers.get("Location") # URL para consultar el estado final
        }
    else:
        # Hubo un error de validación inmediato (ej. esquema inválido)
        logging.error(f"Error enviando factura: {response.text}")
        return {
            "status": "rechazado",
            "error": response.json().get("text", "Error desconocido en el servidor de Hacienda.")
        }

def consultar_estado(location_url, token):
    """
    Consulta el estado de una factura previamente enviada usando el URL de Location.
    """
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(location_url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        estado = data.get("ind-estado")
        return {
            "status": estado,
            "respuesta_xml": data.get("respuesta-xml")
        }
    elif response.status_code == 400:
        return {
            "status": "rechazado",
            "error": "El documento fue rechazado o no se encontró en Hacienda."
        }
    else:
        return {
            "status": "procesando", # Aún no ha terminado de procesar
            "error": f"HTTP {response.status_code}"
        }
