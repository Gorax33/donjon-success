# Succès Donjons

Petit outil pour suivre les succès de tous les donjons de **Dofus 3**, personnage par personnage.

- Donjons classés par tranches de 10 niveaux, avec recherche par nom de donjon ou de boss
- Une case par succès, et une case par donjon pour tout valider d'un coup
- Plusieurs personnages, chacun avec sa classe, sa couleur et sa progression
- Statistiques globales et par tranche, notes par donjon
- ⚙️ sur les boss qui ont une mécanique à connaître (explication au survol, épinglable au clic)
- 📖 lien vers le guide du donjon sur Dofus pour les Noobs
- 📋 copie de la commande `/travel X,Y` vers l'entrée, à coller dans le chat du jeu (zaap le plus proche indiqué)

## Utilisation (Mac ou Windows)

1. Ouvrir le site dans **Google Chrome** ou **Microsoft Edge** (Safari ne gère pas la fenêtre flottante).
2. *Facultatif* : pour en faire une application avec son icône dans le Dock / la barre des tâches,
   menu de Chrome **⋮ > Caster, enregistrer et partager > Installer la page en tant qu'application**.
3. Cliquer sur **⧉** en haut : l'outil s'ouvre dans une petite fenêtre **toujours au premier plan**,
   redimensionnable, à placer à côté du jeu (Dofus en mode fenêtré ou plein écran fenêtré).
   Garder l'onglet d'origine ouvert : le fermer ferme aussi la petite fenêtre.
4. Cliquer sur le rond en haut à droite pour créer ses personnages (classe et couleur).

### Ta progression

Elle est enregistrée **dans ton navigateur**, sur ton ordinateur. Pour ne pas la perdre
(changement de PC, nettoyage du navigateur), menu **☰ > Exporter ma progression** de temps en
temps ; **Importer une sauvegarde** pour la récupérer.

### Nouveaux donjons

Menu **☰ > Mettre à jour depuis DofusDB** récupère les donjons et succès ajoutés au jeu.

## Développement

```bash
npm install
npm run dev          # serveur de dev sur http://localhost:5173
npm run fetch-data   # régénère les données depuis DofusDB (+ images, liens DPLN)
npm run shortcut     # Windows : raccourci bureau en "application Chrome"
```

Chaque envoi sur la branche `main` publie automatiquement le site sur GitHub Pages
(`.github/workflows/pages.yml`).

Le dossier `src-tauri/` contient une version application de bureau (Tauri), non utilisée pour
l'instant.

## Sources

- Données des donjons, succès, boss et classes : [DofusDB](https://dofusdb.fr)
- Mécaniques de boss : résumés rédigés d'après les guides de
  [Dofus pour les Noobs](https://www.dofuspourlesnoobs.com), qui restent la référence complète
- Dofus est un jeu édité par Ankama ; les images du jeu sont la propriété d'Ankama.
  Outil non officiel, sans lien avec Ankama.
