// Proteção contra e-mails FALSOS no cadastro.
// Regra do produto:
//  - Ninguém é impedido de criar conta (várias contas permitidas).
//  - Cada conta exige um e-mail VERDADEIRO e próprio (o mesmo e-mail não pode
//    ser usado em contas diferentes — isso é garantido pelo unique no Model).
//  - Aqui só se bloqueia o que é falso/descartável (sempre e-mail falso = fake).
// isRealEmail() é usada na deleção: contas com e-mail real não podem ser excluídas.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Domínios descartáveis/placeholders conhecidos (manter em minúsculas)
const DISPOSABLE_OR_FAKE_DOMAINS = new Set([
    // Descartáveis/temporários
    'mailinator.com', 'mailinator.net', 'mailinator2.com', 'yopmail.com', 'yopmail.fr',
    'guerrillamail.com', 'guerrillamail.de', 'sharklasers.com', 'grr.la', '10minutemail.com',
    '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'tempsend.com', 'tempinbox.com',
    'trashmail.com', 'throwawaymail.com', 'mailnesia.com', 'maildrop.cc', 'mailcatch.com',
    'spam4.me', 'tempail.com', 'fakemail.net', 'fakeinbox.com', 'mintemail.com',
    'getairmail.com', 'mailtemp.net', 'dispostable.com', 'mytrashmail.com', 'wegwerfmail.de',
    'burnermail.io', 'jetable.org', 'mailmoat.com', 'inboxbear.com', 'mt2015.com',
    'emailfake.com', 'mailmetrash.com', 'trymail.com', 'cuvox.de', 'armyspy.com',
    'dayrep.com', 'teleworm.us', 'einrot.com', 'fryfrge.com', 'superrito.com',
    'freshemail.net', 'lyft.live', 'ourlook.com', 'pelhage.com', 'spamgourmet.com',
    // Placeholders / inválidos
    't.co', 'example.com', 'example.org', 'example.net', 'test.com', 'teste.com',
    'test.net', 'localhost', 'invalid.com', 'sentry.io',
]);

export function isRealEmail(email?: string | null): boolean {
    if (!email) return false;
    const e = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(e)) return false;
    const domain = e.split('@')[1];
    if (DISPOSABLE_OR_FAKE_DOMAINS.has(domain)) return false;
    // Domínios gerados automaticamente (ex: "abc12345678.xyz"), comuns em e-mail fake
    if (/^[a-z0-9]+\.(xyz|top|site|club|online|gq|ml|cf|ga|tk)$/.test(domain)) return false;
    return true;
}

export interface EmailGuardResult {
    block: boolean;
    reason?: string;
}

export function getEmailGuardResult(email?: string | null): EmailGuardResult {
    if (!email) return { block: true, reason: 'Email é obrigatório' };
    const e = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(e)) return { block: true, reason: 'Formato de email inválido' };

    const domain = e.split('@')[1];

    if (DISPOSABLE_OR_FAKE_DOMAINS.has(domain)) {
        return { block: true, reason: `Domínio ${domain} não é permitido (email falso/descartável)` };
    }
    if (/^[a-z0-9]+\.(xyz|top|site|club|online|gq|ml|cf|ga|tk)$/.test(domain)) {
        return { block: true, reason: 'Email parece ser falso (domínio gerado automaticamente)' };
    }

    // Qualquer outro (inclusive com nome estranho) passa: o email deve ser verdadeiro,
    // mas quem é impedido de criar conta é só quem usa email falso/descartável.
    return { block: false };
}