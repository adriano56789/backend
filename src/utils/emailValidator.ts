import dns from 'dns';
import net from 'net';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidFormat(email: string): boolean {
    return EMAIL_REGEX.test(email);
}

function resolveMx(domain: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        dns.resolveMx(domain, (err, addresses) => {
            if (err) return reject(err);
            const mxHosts = addresses
                .sort((a, b) => a.priority - b.priority)
                .map(a => a.exchange);
            resolve(mxHosts);
        });
    });
}

function verifySmtp(mxHost: string, email: string, timeoutMs: number = 8000): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let responded = false;
        let step = 0;
        const domain = email.split('@')[1];

        const cleanup = () => {
            responded = true;
            socket.destroy();
        };

        socket.setTimeout(timeoutMs);

        socket.on('connect', () => {
            socket.write(`HELO ${domain}\r\n`);
        });

        let buffer = '';

        socket.on('data', (data) => {
            if (responded) return;
            buffer += data.toString();

            const lines = buffer.split('\r\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const code = parseInt(line.substring(0, 3), 10);

                if (step === 0 && line.includes('220')) {
                    step = 1;
                    socket.write(`HELO ${domain}\r\n`);
                    return;
                }

                if (step === 1 && (line.includes('250') || code === 250)) {
                    step = 2;
                    socket.write(`MAIL FROM:<verify@${domain}>\r\n`);
                    return;
                }

                if (step === 2 && (line.includes('250') || code === 250)) {
                    step = 3;
                    socket.write(`RCPT TO:<${email}>\r\n`);
                    return;
                }

                if (step === 3) {
                    cleanup();
                    if (line.includes('250') || code === 250) {
                        resolve(true);
                    } else if (line.includes('550') || code === 550) {
                        resolve(false);
                    } else {
                        resolve(false);
                    }
                    return;
                }
            }
        });

        socket.on('error', (err) => {
            if (!responded) {
                cleanup();
                reject(err);
            }
        });

        socket.on('timeout', () => {
            if (!responded) {
                cleanup();
                reject(new Error('SMTP timeout'));
            }
        });

        socket.on('close', () => {
            if (!responded) {
                resolve(false);
            }
        });

        socket.connect(25, mxHost);
    });
}

export interface EmailValidationResult {
    valid: boolean;
    reason?: string;
    details?: {
        format: boolean;
        mxRecords: boolean;
        smtpVerified: boolean | null;
    };
}

export async function validateEmail(email: string): Promise<EmailValidationResult> {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidFormat(cleanEmail)) {
        return { valid: false, reason: 'Formato de email inválido', details: { format: false, mxRecords: false, smtpVerified: null } };
    }

    const domain = cleanEmail.split('@')[1];

    let mxHosts: string[];
    try {
        mxHosts = await resolveMx(domain);
    } catch {
        return { valid: false, reason: `Domínio ${domain} não possui servidor de email`, details: { format: true, mxRecords: false, smtpVerified: null } };
    }

    if (!mxHosts || mxHosts.length === 0) {
        return { valid: false, reason: `Domínio ${domain} não aceita emails`, details: { format: true, mxRecords: false, smtpVerified: null } };
    }

    // SMTP verification — apenas informativo, nunca bloqueia
    let smtpVerified: boolean | null = null;
    for (const mx of mxHosts.slice(0, 2)) {
        try {
            smtpVerified = await verifySmtp(mx, cleanEmail);
            if (smtpVerified) break;
        } catch {
            continue;
        }
    }

    return {
        valid: true,
        details: { format: true, mxRecords: true, smtpVerified }
    };
}
