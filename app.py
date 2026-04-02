import os
import re
import io
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
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

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

CATEGORIES = [
    "Technologie", "Santé", "Politique", "Economie", "Climat", "Automobile",
    "Sciences", "Société", "Monde", "Finance", "Education",
    "E-Commerce", "Actualités (news)", "Immobilier"
]

SECTIONS = [
    {
        "index": 1,
        "title": "Analyse des Entités (Knowledge Graph)",
        "prompt": (
            "## 1. Analyse des Entités (Knowledge Graph)\n"
            "* **Entités Principales Identifiées :** Liste les personnes, lieux, "
            "organisations ou concepts clés trouvés.\n"
            "* **Entités Manquantes (Opportunités) :** Quelles entités sémantiquement "
            "proches ou contextuelles (LSI) manquent ?"
        ),
    },
    {
        "index": 2,
        "title": "Optimisation des Titres (Haut CTR pour Discover)",
        "prompt": (
            "## 2. Optimisation des Titres (Haut CTR pour Discover)\n"
            "Propose 5 titres optimisés pour Google Discover. Ils doivent être "
            "accrocheurs sans être du clickbait mensonger.\n"
            "* Titre 1 :\n* Titre 2 :\n* Titre 3 :\n* Titre 4 :\n* Titre 5 :"
        ),
    },
    {
        "index": 3,
        "title": "Concepts Manquants & Profondeur (E-E-A-T)",
        "prompt": (
            "## 3. Concepts Manquants & Profondeur (E-E-A-T)\n"
            "Identifie les concepts ou sous-sujets absents qui empêchent cet article "
            "d'être la référence ultime sur le sujet."
        ),
    },
    {
        "index": 4,
        "title": "Recommandations de Réécriture",
        "prompt": (
            "## 4. Recommandations de Réécriture\n"
            "Propose 2 ou 3 paragraphes spécifiques réécrits pour améliorer :\n"
            "* L'accroche (le début de l'article).\n"
            "* La clarté d'un passage complexe.\n"
            "* L'ajout d'émotion ou d'expertise."
        ),
    },
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


def call_gemini_section(section, category, content):
    """Appelle Gemini pour UNE section. Exécuté en parallèle."""
    prompt = f"""Tu es un expert en SEO et spécialiste de l'algorithme Google Discover.
Analyse le contenu suivant et réponds UNIQUEMENT à la section demandée, en Markdown, en Français.

CONTEXTE :
- Rubrique : {category}
- Contenu à analyser :
"{content}"

TÂCHE — réponds uniquement à cette section :
{section['prompt']}
"""
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)
    return section["index"], response.text.strip()


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
    if not GEMINI_API_KEY:
        return jsonify({"error": "La variable d'environnement GEMINI_API_KEY n'est pas définie."}), 500

    def generate():
        try:
            results = {}
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = {
                    executor.submit(call_gemini_section, section, category, content): section
                    for section in SECTIONS
                }
                for future in as_completed(futures):
                    try:
                        idx, text = future.result()
                        results[idx] = text
                        yield f"data: {json.dumps({'progress': idx})}\n\n"
                    except Exception as e:
                        yield f"data: {json.dumps({'error': str(e)})}\n\n"
                        return

            full_report = "\n\n".join(results[s["index"]] for s in SECTIONS)
            yield f"data: {json.dumps({'report': full_report})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


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
