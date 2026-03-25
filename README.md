# SmartDiscover

Optimiseur de contenu pour **Google Discover**, propulsé par **Gemini AI**.

Analyse sémantique complète : entités Knowledge Graph, titres CTR, E-E-A-T, recommandations de réécriture.

---

## Fonctionnalités

- 🔗 Extraction automatique depuis une URL (BeautifulSoup)
- ✏️ Copier/coller de texte directement
- 📎 Upload de fichier `.txt` ou `.docx`
- 🌙/☀️ Thème clair/sombre avec mémorisation
- 🤖 Analyse Gemini en 4 sections structurées

---

## Installation locale

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-compte/smartdiscover.git
cd smartdiscover

# 2. Créer un environnement virtuel
python -m venv venv
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer la clé API
cp .env.example .env
# Éditez .env et renseignez votre GEMINI_API_KEY

# 5. Charger les variables et lancer
export GEMINI_API_KEY=votre_clé   # macOS/Linux
set GEMINI_API_KEY=votre_clé      # Windows

python app.py
```

Accédez à **http://127.0.0.1:5000**

---

## Déploiement sur Render

1. Créez un compte sur [render.com](https://render.com)
2. **New → Web Service** → connectez votre repo GitHub
3. Render détecte automatiquement `render.yaml`
4. Dans **Environment → Environment Variables**, ajoutez :
   - `GEMINI_API_KEY` = votre clé ([obtenir ici](https://aistudio.google.com/app/apikey))
5. Cliquez **Deploy**

> ⚠️ Ne committez jamais votre `.env` ou votre clé API dans Git.

---

## Structure du projet

```
smartdiscover/
├── app.py                  # Backend Flask
├── requirements.txt        # Dépendances Python
├── render.yaml             # Config déploiement Render
├── .env.example            # Template variables d'environnement
├── .gitignore
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/app.js
```

---

## Obtenir une clé API Gemini

La clé est **gratuite** sur [Google AI Studio](https://aistudio.google.com/app/apikey).
