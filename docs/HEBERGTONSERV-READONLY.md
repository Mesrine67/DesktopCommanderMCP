# HébergTonServ Desktop – profil MCP de lecture seule

Cette variante conserve les fichiers, la licence, les auteurs et l'architecture upstream de DesktopCommanderMCP.

## Mode opt-in

Le profil strict n'est actif **que si** `HTS_MCP_READ_ONLY=1`.

Définir également `HTS_MCP_ROOT` sur un **dossier absolu existant** explicitement autorisé.
Sans racine valide, aucune lecture n'est autorisée. L'application HébergTonServ ne lance pas encore ce MCP automatiquement.

Lancement manuel de développement :

```powershell
$env:HTS_MCP_READ_ONLY = '1'
$env:HTS_MCP_ROOT = 'E:\Projects\example-read-only'
node dist/index.js
```

Les seuls outils exposés dans ce mode sont `read_file`, `read_multiple_files`, `list_directory` et `get_file_info`. Chaque appel est **revérifié au serveur**, même si un client contourne la liste des outils.

Les commandes/processus, modifications de fichiers, changements de configuration, appels d'URL et ressources MCP UI sont interdits. Les chemins symboliques et jonctions sont résolus pour empêcher la lecture hors du dossier. La profondeur de listage est bornée.

La télémétrie est désactivée dans ce mode, quelle que soit la configuration utilisateur enregistrée.

## Connexion à HébergTonServ Desktop

1. Conserver Codex App Server dans un profil séparé (son `CODEX_HOME` isolé est déjà créé).
2. Prévoir une confirmation utilisateur pour le dossier choisi avant d'autoriser la connexion MCP.
3. Fournir le chemin du dossier via `HTS_MCP_ROOT` dans l'environnement du processus serveur.
4. Vérifier la liste des outils et les permissions effectives avant chaque exposition à un agent.
5. Pour toute écriture, commande distante ou intervention VPS : développer un chemin d'approbation spécifique et tracé. Ne jamais désactiver le mode restreint par défaut.

Cette fonctionnalité est **en cours de test** et ne doit pas être présentée comme un accès distant opérationnel.
