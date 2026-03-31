import os
import re
import io
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import requests
from bs4 import BeautifulSoup

# Optional .docx support
try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

app = Flask(__name__)

# Clé API chargée depuis la variable d'environnement
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

CATEGORIES = [
    "Technologie", "Santé", "Politique", "Economie", "Climat",
    "Sciences", "Société", "Monde", "Finance", "Education",
    "E-Commerce", "Actualités (news)", "Immobilier"
]


def extract_text_from_url(url):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
            tag.decompose()
        article = soup.find("article") or soup.find(id=re.compile(r"content|article|main|body", re.I))
        target = article or soup.find("body") or soup
        paragraphs = target.find_all("p")
        text = "\n\n".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 40)
        if len(text) < 100:
            text = target.get_text(separator="\n", strip=True)
        return text[:8000]
    except requests.exceptions.Timeout:
        raise ValueError("La requête a expiré. L'URL est peut-être inaccessible.")
    except requests.exceptions.HTTPError as e:
        raise ValueError(f"Erreur HTTP {e.response.status_code} lors de l'accès à l'URL.")
    except Exception as e:
        raise ValueError(f"Impossible d'extraire le contenu : {str(e)}")


def analyze_with_gemini(category, content):
    if not GEMINI_API_KEY:
        raise ValueError("La variable d'environnement GEMINI_API_KEY n'est pas définie sur ce serveur.")
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"""
Tu es un expert en SEO et spécialiste de l'algorithme Google Discover.
Ta mission est d'optimiser un contenu pour qu'il devienne viral sur Discover.

CONTEXTE :
- Rubrique : {category}
- Contenu à analyser :
"{content}"

TACHE :
Analyse ce texte et fournis un rapport détaillé en Markdown structuré comme suit :

## 1. Analyse des Entités (Knowledge Graph)
* **Entités Principales Identifiées :** Liste les personnes, lieux, organisations ou concepts clés trouvés.
* **Entités Manquantes (Opportunités) :** Quelles entités sémantiquement proches ou contextuelles (LSI) manquent ?

## 2. Optimisation des Titres (Haut CTR pour Discover)
Propose 5 titres optimisés pour Google Discover.
* Titre 1 :
* Titre 2 :
* Titre 3 :
* Titre 4 :
* Titre 5 :

## 3. Concepts Manquants & Profondeur (E-E-A-T)
Identifie les concepts ou sous-sujets absents qui empêchent cet article d'être la référence ultime sur le sujet.

## 4. Recommandations de Réécriture
Propose 2 ou 3 paragraphes spécifiques réécrits pour améliorer l'accroche, la clarté ou l'expertise.

Réponds en Français, avec un ton professionnel et pédagogique.
"""
    response = model.generate_content(prompt)
    return response.text


@app.route("/")
def index():
    api_key_configured = bool(GEMINI_API_KEY)
    return render_template("index.html", categories=CATEGORIES, api_key_configured=api_key_configured)


@app.route("/extract", methods=["POST"])
def extract():
    data = request.get_json()
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL manquante."}), 400
    try:
        text = extract_text_from_url(url)
        if len(text) < 50:
            return jsonify({"error": "Contenu insuffisant extrait de cette URL."}), 422
        return jsonify({"content": text})
    except ValueError as e:
        return jsonify({"error": str(e)}), 422


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    category = data.get("category", "Technologie")
    content = data.get("content", "").strip()
    if len(content) < 50:
        return jsonify({"error": "Le texte est trop court pour être analysé."}), 400
    try:
        result = analyze_with_gemini(category, content)
        return jsonify({"report": result})
    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu."}), 400

    file = request.files["file"]
    filename = file.filename.lower()

    try:
        if filename.endswith(".txt"):
            raw = file.read()
            text = raw.decode("utf-8", errors="replace")
        elif filename.endswith(".docx"):
            if not DOCX_AVAILABLE:
                return jsonify({"error": "Support .docx non disponible. Installez python-docx."}), 500
            doc = docx.Document(io.BytesIO(file.read()))
            text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif filename.endswith(".doc"):
            return jsonify({"error": "Le format .doc n'est pas supporté. Convertissez en .docx ou .txt."}), 422
        else:
            return jsonify({"error": "Format non supporté. Utilisez .txt ou .docx."}), 422

        text = text.strip()[:8000]
        if len(text) < 50:
            return jsonify({"error": "Le fichier semble vide ou trop court."}), 422
        return jsonify({"content": text})

    except Exception as e:
        return jsonify({"error": f"Erreur lors de la lecture du fichier : {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=False)
