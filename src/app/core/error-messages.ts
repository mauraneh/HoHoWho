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
    'L’orga doit d’abord fermer la liste.',
  ],
  [/already been drawn/i, 'Le tirage a déjà eu lieu pour ce Secret Santa.'],
  [
    /no valid draw exists/i,
    'Aucun tirage n’est possible avec les exclusions actuelles. Il faut en retirer quelques-unes (on a dit petits arrangements !).',
  ],
  [/draw violates an exclusion|invalid draw/i, 'Le tirage n’est pas valide. Réessaie.'],
  [/could not reach the draw service/i, 'Les lutins du tirage ne répondent pas. Réessaie.'],
  [/the draw failed/i, 'Le tirage a coincé. Réessaie.'],
  [/could not load/i, 'Impossible de charger les données. Réessaie.'],
  [/event not found/i, 'Ce Secret Santa s’est perdu dans la neige.'],
  [
    /exclusions can only be chosen/i,
    'Les exclusions se choisissent après la fermeture de la liste et avant le tirage.',
  ],
  [/leave at least one person/i, 'Laisse au moins une personne à qui offrir un cadeau !'],
  [/cannot exclude yourself/i, 'Tu ne peux pas t’exclure toi-même (bien tenté).'],
  [/unknown participant/i, 'Participant inconnu.'],
  [/messages must be/i, 'Un message doit faire entre 1 et 2000 caractères.'],
  [/only organisers can create/i, 'Seule l’orga peut créer un Secret Santa.'],
  [/only the organiser can close/i, 'Seule l’orga peut fermer la liste.'],
  [/only the organiser can reopen/i, 'Seule l’orga peut rouvrir la liste.'],
  [/only the organiser can delete/i, 'Seule l’orga peut supprimer ce Secret Santa.'],
  [/only the organiser can invite/i, 'Seule l’orga peut inviter du monde.'],
  [/only the organiser can see e-mail/i, 'Seule l’orga peut voir les adresses e-mail.'],
  [/only the organiser can draw/i, 'Seule l’orga peut lancer le tirage.'],
  [/reopened before the draw/i, 'La liste ne peut être rouverte qu’avant le tirage.'],
  [/list is already closed/i, 'La liste est déjà fermée.'],
  [/invitations are closed/i, 'Les invitations sont fermées.'],
  [
    /invitation is invalid/i,
    'Ce lien a fondu (expiré, révoqué ou liste déjà fermée). Demande-en un nouveau à l’orga.',
  ],
  [/only possible while the list is open/i, 'Ce n’est possible que tant que la liste est ouverte.'],
  [/participant cannot be removed/i, 'Ce participant ne peut plus être retiré.'],
  [
    /sign-in link has expired/i,
    'Ce lien de connexion a expiré ou a déjà servi. Demandes-en un nouveau.',
  ],
  [/too many sign-in e-mails/i, 'Trop d’e-mails envoyés. Patiente quelques minutes puis réessaie.'],
  [/could not send the sign-in link/i, 'Impossible d’envoyer le lien de connexion. Réessaie.'],
  [/valid e-mail/i, 'Il faut une adresse e-mail valide.'],
  [
    /personal link is not valid/i,
    'Ce lien perso ne marche plus. Demande un nouveau lien à l’orga.',
  ],
  [/wrong organiser code/i, 'Mauvais code ! Les lutins ne te laissent pas entrer.'],
  [/organiser code is not configured/i, 'Le code organisatrice n’est pas encore configuré.'],
  [/enter your first name/i, 'Il nous faut ton prénom !'],
  [/too many attempts/i, 'Trop de tentatives. Patiente quelques minutes.'],
  [/does not use a personal link/i, 'Ce compte n’utilise pas de lien personnel.'],
  [/could not reach the server/i, 'Impossible de joindre le pôle Nord. Réessaie.'],
  [/only the organiser can do this/i, 'Seule l’orga peut faire ça.'],
  [/please sign in|sign in required|not authenticated/i, 'Ouvre d’abord ton lien perso.'],
  [/not part of this event/i, 'Tu ne fais pas partie de ce Secret Santa.'],
  [/not allowed/i, 'Tu n’as pas le droit de faire ça.'],
  [/values are invalid/i, 'Certaines valeurs clochent. Vérifie le formulaire.'],
  [/already exists/i, 'Cela existe déjà.'],
  [/profile not found/i, 'Profil introuvable. Rouvre ton lien perso.'],
  [/validity must be/i, 'La validité doit être comprise entre 1 et 60 jours.'],
];

export const GENERIC_ERROR = 'Oups, quelque chose a coincé. Réessaie.';

export function translateError(message: string): string {
  for (const [pattern, translation] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return typeof translation === 'string' ? translation : translation(match);
  }
  return GENERIC_ERROR;
}
