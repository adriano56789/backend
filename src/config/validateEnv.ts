import { ENV } from './env';

interface RequiredVar {
  name: string;
  hint: string;
  strictlyRequired?: boolean;
}

const requiredVars: RequiredVar[] = [
  { name: 'MONGODB_URI', hint: 'mongodb://usuario:senha@host:porta/banco', strictlyRequired: true },
  { name: 'JWT_SECRET', hint: 'qualquer string segura de 32+ caracteres', strictlyRequired: true },
  { name: 'MERCADO_PAGO_ACCESS_TOKEN', hint: 'token de acesso da API do Mercado Pago' },
  { name: 'MERCADO_PAGO_CLIENT_ID', hint: 'client ID do Mercado Pago' },
  { name: 'MERCADO_PAGO_CLIENT_SECRET', hint: 'client secret do Mercado Pago' },
];

export function validateEnv(): void {
  const missingStrict: string[] = [];
  const missingOptional: string[] = [];

  const isProduction = ENV.NODE_ENV === 'production';
  const useRealApis = ENV.USE_REAL_APIS;

  for (const v of requiredVars) {
    if (!process.env[v.name]) {
      if (v.strictlyRequired || isProduction || useRealApis) {
        missingStrict.push(`${v.name} — ${v.hint || 'sem descrição'}`);
      } else {
        missingOptional.push(`${v.name} — ${v.hint || 'sem descrição'}`);
      }
    }
  }

  if (missingOptional.length > 0) {
    console.warn('\n⚠️  [ENV] Variáveis de ambiente opcionais faltando (usando fallbacks em dev):\n');
    missingOptional.forEach(v => console.warn(`   • ${v}`));
  }

  if (missingStrict.length > 0) {
    console.error('\n❌ [ENV] Variáveis de ambiente obrigatórias faltando:\n');
    missingStrict.forEach(v => console.error(`   • ${v}`));
    console.error('\n⚠️  Configure-as no arquivo .env ou nas env vars do container.\n');
    process.exit(1);
  }

  console.log(`✅ [ENV] Configuração validada (Mode: ${ENV.NODE_ENV}, Real APIs: ${ENV.USE_REAL_APIS})`);
}
