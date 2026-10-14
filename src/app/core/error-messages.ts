/**
 * French translations of the messages raised by the backends (database functions, Edge
 * Function, mock backend). Backends keep stable English messages; the UI shows French.
 */
const TRANSLATIONS: readonly [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/at least (\d+) participants are required/i, (m) => `Il faut au moins ${m[1]} participants.`],
  [
    /waiting for (\d+) participant/i,
    (m) => `En attente de ${m[1]} participant(s) qui n’ont pas encore validé.`,
  ],
  [
    /close the list before drawing|must close the list first/i,
    'L’organisateur doit d’abord fermer la liste.',
  ],
  [/already been drawn/i, 'Le tirage a déjà eu lieu pour ce Secret Santa.'],
  [
    /no valid draw exists/i,
    'Aucun tirage n’est possible avec les exclusions actuelles. Il faut en retirer quelques-unes.',
  ],
  [/draw violates an exclusion|invalid draw/i, 'Le tirage n’est pas valide. Réessayez.'],
  [/could not reach the draw service/i, 'Impossible de joindre le service de tirage. Réessayez.'],
  [/the draw failed/i, 'Le tirage a échoué. Réessayez.'],
  [/could not load/i, 'Impossible de charger les données. Réessayez.'],
  [/event not found/i, 'Secret Santa introuvable.'],
  [
    /exclusions can only be chosen/i,
    'Les exclusions se choisissent après la fermeture de la liste et avant le tirage.',
  ],
  [
    /leave at least one person/i,
    'Laissez au moins une personne à qui vous pourriez offrir un cadeau.',
  ],
  [/cannot exclude yourself/i, 'Vous ne pouvez pas vous exclure vous-même.'],
  [/unknown participant/i, 'Participant inconnu.'],
  [/messages must be/i, 'Un message doit faire entre 1 et 2000 caractères.'],
  [/only organisers can create/i, 'Seuls les organisateurs peuvent créer un Secret Santa.'],
  [/only the organiser can close/i, 'Seul l’organisateur peut fermer la liste.'],
  [/only the organiser can reopen/i, 'Seul l’organisateur peut rouvrir la liste.'],
  [/only the organiser can delete/i, 'Seul l’organisateur peut supprimer ce Secret Santa.'],
  [/only the organiser can invite/i, 'Seul l’organisateur peut inviter des participants.'],
  [/only the organiser can see e-mail/i, 'Seul l’organisateur peut voir les adresses e-mail.'],
  [/only the organiser can draw/i, 'Seul l’organisateur peut lancer le tirage.'],
  [/reopened before the draw/i, 'La liste ne peut être rouverte qu’avant le tirage.'],
  [/list is already closed/i, 'La liste est déjà fermée.'],
  [/invitations are closed/i, 'Les invitations sont fermées.'],
  [
    /invitation is invalid/i,
    'Cette invitation n’est plus valable (expirée, révoquée ou liste déjà fermée).',
  ],
  [/only possible while the list is open/i, 'Ce n’est possible que tant que la liste est ouverte.'],
  [/participant cannot be removed/i, 'Ce participant ne peut plus être retiré.'],
  [
    /sign-in link has expired/i,
    'Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous.',
  ],
  [
    /too many sign-in e-mails/i,
    'Trop d’e-mails de connexion envoyés. Patientez quelques minutes puis réessayez.',
  ],
  [/could not send the sign-in link/i, 'Impossible d’envoyer le lien de connexion. Réessayez.'],
  [/valid e-mail/i, 'Merci d’indiquer une adresse e-mail valide.'],
  [
    /personal link is not valid/i,
    'Ce lien personnel n’est plus valable. Demandez-en un nouveau à l’organisatrice.',
  ],
  [/wrong organiser code/i, 'Code organisatrice incorrect.'],
  [/organiser code is not configured/i, 'Le code organisatrice n’est pas encore configuré.'],
  [/enter your first name/i, 'Indiquez votre prénom.'],
  [/too many attempts/i, 'Trop de tentatives. Patientez quelques minutes.'],
  [/does not use a personal link/i, 'Ce compte n’utilise pas de lien personnel.'],
  [/could not reach the server/i, 'Impossible de joindre le serveur. Réessayez.'],
  [/only the organiser can do this/i, 'Seul l’organisateur peut faire cela.'],
  [/please sign in|sign in required|not authenticated/i, 'Merci de vous connecter d’abord.'],
  [/not part of this event/i, 'Vous ne participez pas à ce Secret Santa.'],
  [/not allowed/i, 'Vous n’avez pas l’autorisation de faire cela.'],
  [/values are invalid/i, 'Certaines valeurs sont invalides. Vérifiez le formulaire.'],
  [/already exists/i, 'Cela existe déjà.'],
  [/profile not found/i, 'Profil introuvable. Reconnectez-vous.'],
  [/validity must be/i, 'La validité doit être comprise entre 1 et 60 jours.'],
];

export const GENERIC_ERROR = 'Une erreur est survenue. Réessayez.';

export function translateError(message: string): string {
  for (const [pattern, translation] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return typeof translation === 'string' ? translation : translation(match);
  }
  return GENERIC_ERROR;
}
