# Liste de bookmarklets HAL

Ce dépôt contient une liste de bookmarklets utilisables sur HAL et AuréHAL, pour simplifier et gagner du temps sur certaines tâches. Les scripts AuréHAL nécessitent des droits d'administrateur de portail.
Chaque script contient une version indentée et une version 'mini' à copier-coller. 

## Qu'est-ce qu'un bookmarklet ?
Un bookmarklet est un petit programme Javascript stocké dans un favori de navigateur web, que l'on exécute en un clic depuis un page. Il permet d'effectuer des actions

### Installer un bookmarklet:

	1. Créer un nouveau favori dans le navigateur (ou marque-page sur Firefox)
	2. Sur le favori, faire clic droit > “modifier…” (ou “modifier le marque-page” sur Firefox)
	3. Dans la case “URL”, coller le script puis enregistrer
	4. Une fois sur la page HAL ou AuréHAL, cliquer sur le favori pour exécuter le script

-------------------------------------

## Script détection de doublon (Duplicate.js) 

A exécuter depuis une page de dépôt HAL pour repérer d'éventuels doublons

### Fonctionnement :

	1. Le script récupère les métadonnées de la notice HAL ouverte (doi + titre)
	2. Fait une requête API sur le doi et sur les 12 premiers mots du titre
	3. Exclut la notice courante et les notices avec un doi strictement différent des résultats
	4. Affiche les doublons potentiels dans une fenêtre flottante, avec liens cliquables, titre et doi

<img width="1092" height="435" alt="Capture d&#39;écran 2025-11-28 103045" src="https://github.com/user-attachments/assets/32b8e174-fca6-4ff6-9609-d9e41edca859" />

## Script ID Catcher (Id_Catcher.js)

A exécuter depuis une page auteur AuréHAL pour récupérer des identifiants sur IdRef et ORCID.

### Fonctionnement :

	1. Le script récupère le nom de l'auteur depuis la page auréhal
	2. Fait une requête API IdRef et ORCID a partir du nom
	3. Affiche les Ids des candidats dans une popup avec leur nom, description idRef, lien vers les pages IdRef et ORCID, et bouton pour rapidement copier l'ID.

<img width="1522" height="848" alt="Capture d&#39;écran 2026-02-05 183627" src="https://github.com/user-attachments/assets/803afe4e-c998-4603-b5ea-26717f043a51" />

## Script CollectionChecker (CollCheck.js)

A exécuter sur l'onglet "Liste des documents" depuis une page auteur AuréHAL en cours de modification pour pour visualiser rapidement si les dépôts appartiennent ou non à une collection. Utile pour répartir les dépôts entre auteurs homonymes. Après l'exécution du script, entrer le code collection et cliquer sur "Vérifier".

### Fonctionnement :

	1. Le script ouvre une pop-up contenant une boite dans laquelle taper le nom de la collection recherchée
	2. Fait une requête API HAL sur les dépôts présents dans la liste pour vérifier s'ils appartiennent à la collection concernée
	3. Les dépôts appartenant à la collection sont surlignés en vert

<img width="1500" height="773" alt="Capture d&#39;écran 2026-09-01 105012" src="https://github.com/user-attachments/assets/bb97ca6b-cb74-4f89-92e1-bafba041340a" />

## Script Doi Finder (Doi_Finder.js)

A exécuter sur une notice sans doi pour repérer si la publication possède un doi référencé dans la base Crossref.

### Fonctionnement :

	1. Le script récupère les titre, noms d'auteurs et nom de revue de la notice ouverte
	2. Fait une requête Crossref à partir du titre, avec en fallback une requête sur les autres notices HAL mentionnant la même revue
	3. Affiche une pop-up contenant les résultats les plus proches avec calcul d'un score de probabilité (70% coefficient de Dice sur les tokens du titre, 30% taux de correspondance des noms de famille des auteurs)

<img width="1342" height="595" alt="image" src="https://github.com/user-attachments/assets/47e869fc-3429-4f90-b55d-2bc07e29847e" />

## Script Jsonfier (Jsonfier.js)

A exécuter depuis une page de dépôt HAL pour accéder à la notice au format json (https://api.archives-ouvertes.fr/search?q=docid:XXXXXXX&fl=*&wt=json)

### Fonctionnement :

	1. Le script récupère le docid et construit l'URL de la notice au format json, puis l'ouvre
