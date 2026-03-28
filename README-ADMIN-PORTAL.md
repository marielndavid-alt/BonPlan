# 🎛️ Portail Admin Bon Plan - Guide d'utilisation

## 📋 Prérequis

- Python 3 installé sur ton ordinateur ([télécharger ici](https://www.python.org/downloads/))
- Ton fichier `.env` du projet React Native (pour récupérer la clé `EXPO_PUBLIC_SUPABASE_ANON_KEY`)

## 🚀 Lancement rapide (3 étapes)

### 1️⃣ Ouvre un terminal dans le dossier du projet

**Sur Mac/Linux :**
```bash
cd /chemin/vers/ton/projet
```

**Sur Windows (PowerShell) :**
```powershell
cd C:\chemin\vers\ton\projet
```

### 2️⃣ Lance le serveur HTTP

```bash
python3 -m http.server 8080
```

> ⚠️ **Important** : Laisse cette fenêtre de terminal ouverte tant que tu utilises le portail !

### 3️⃣ Ouvre le portail dans ton navigateur

Va sur : **http://localhost:8080/admin-portal-fixed.html**

---

## 🔑 Configuration initiale

Au premier lancement, tu dois entrer :

1. **URL du projet** : `https://jvmqoployrhzpmhydjvmq.backend.onspace.ai`
2. **Clé anon** : Ouvre ton fichier `.env` et copie la valeur de `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Ces informations sont sauvegardées dans ton navigateur. Tu n'auras plus besoin de les entrer par la suite !

---

## 📂 Import de prix CSV

1. Va sur l'onglet **📥 Importer CSV**
2. Glisse ton fichier CSV dans la zone ou clique pour le sélectionner
3. L'import se fait automatiquement par batch de 50 produits
4. Tu verras une barre de progression en temps réel

**Colonnes supportées :**
- Magasin, SKU, Nom du produit, Marque
- Prix régulier ($), Prix promo ($)
- Format - Valeur, Format - Unité
- Prix effectif normalisé, Unité normalisation, Prix régulier normalisé
- URL produit, URL image, URL source

---

## ❓ Dépannage

### ❌ "Failed to fetch" ou erreurs de connexion

**Problème** : Tu ouvres le fichier HTML directement (double-clic) au lieu d'utiliser le serveur HTTP.

**Solution** : Ferme le fichier et relance avec `python3 -m http.server 8080`, puis ouvre `http://localhost:8080/admin-portal-fixed.html`

### ❌ "Port déjà utilisé"

**Problème** : Le port 8080 est déjà occupé.

**Solution** : Utilise un autre port :
```bash
python3 -m http.server 8888
```
Puis ouvre : `http://localhost:8888/admin-portal-fixed.html`

### ❌ "Python not found"

**Problème** : Python n'est pas installé.

**Solution** :
- **Mac** : Python 3 est pré-installé. Essaye `python3 -m http.server 8080`
- **Windows** : Télécharge Python sur [python.org/downloads](https://www.python.org/downloads/) et coche "Add Python to PATH" pendant l'installation

---

## 🛠️ Alternatives de serveur HTTP

Si Python ne fonctionne pas, tu peux utiliser :

**Node.js (si installé) :**
```bash
npx http-server -p 8080
```

**VS Code Live Server :**
1. Installe l'extension "Live Server"
2. Clic droit sur `admin-portal-fixed.html` → "Open with Live Server"

**PHP (si installé) :**
```bash
php -S localhost:8080
```

---

## 📊 Fonctionnalités du portail

- ✅ **Dashboard** : Statistiques globales (recettes, produits, prix, utilisateurs)
- ✅ **Recettes** : Créer, modifier, supprimer des recettes
- ✅ **Import CSV** : Importer des milliers de prix automatiquement
- 🚧 **Produits** : Section en cours d'implémentation
- 🚧 **Prix** : Section en cours d'implémentation
- 🚧 **Magasins** : Section en cours d'implémentation
- 🚧 **Scraping** : Section en cours d'implémentation
- 🚧 **Classification AI** : Section en cours d'implémentation
- 🚧 **Utilisateurs** : Section en cours d'implémentation

---

## 📝 Notes

- Les identifiants (URL + clé) sont sauvegardés dans **localStorage** de ton navigateur
- Pour réinitialiser : va dans l'onglet **⚙️ Paramètres** → **Reconfigurer**
- Les erreurs d'import détaillées s'affichent pour faciliter le débogage

---

## 🆘 Besoin d'aide ?

Si tu rencontres un problème :
1. Ouvre la console du navigateur (F12)
2. Note les messages d'erreur
3. Vérifie que tu utilises bien le serveur HTTP (URL = `http://localhost:...`)
