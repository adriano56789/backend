import { httpClient } from './httpClient';

export class Security {
  static async getClientIP(): Promise<string> {
    try {
      const data = await httpClient.get<{ ip: string }>('https://api.ipify.org?format=json');
      return data.ip;
    } catch (error) {
      console.warn('Falha ao obter IP:', error);
      return 'unknown';
    }
  }

  static detectAbuse(userId: string, recentRequests: any[]): boolean {
    if (recentRequests.length > 10) {
      console.warn('🚨 Abuso detectado - muitas requisições:', { userId, requestCount: recentRequests.length });
      return true;
    }

    const regions = new Set(recentRequests.map(r => r.region));
    if (regions.size > 3) {
      console.warn('🚨 Abuso detectado - múltiplas regiões:', { userId, regions: Array.from(regions) });
      return true;
    }

    const sortedRequests = recentRequests.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 1; i < sortedRequests.length; i++) {
      const timeDiff = sortedRequests[i].timestamp - sortedRequests[i - 1].timestamp;
      if (timeDiff < 30000) {
        console.warn('🚨 Abuso detectado - requisições muito rápidas:', { userId, timeDiff });
        return true;
      }
    }

    return false;
  }

  static async blockAbusiveUser(userId: string, reason: string, duration: number = 3600): Promise<void> {
    try {
      const clientIP = await this.getClientIP();

      const response = await fetch('/api/security/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason, timestamp: new Date().toISOString(), clientIP, permanent: false, duration })
      });

      if (response.ok) {
        console.log('🚫 Usuário bloqueado com sucesso:', { userId, reason, duration });
      } else {
        throw new Error('Falha ao bloquear usuário');
      }
    } catch (error) {
      console.error('❌ Falha ao bloquear usuário abusivo:', error);
      throw error;
    }
  }

  static async auditCredentialsUsage(userId: string, action: string, metadata: any = {}): Promise<void> {
    try {
      const clientIP = await this.getClientIP();

      const auditData = { userId, action, timestamp: new Date().toISOString(), clientIP, metadata };

      const response = await fetch('/api/security/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData)
      });

      if (!response.ok) {
        console.warn('⚠️ Falha ao registrar auditoria:', auditData);
      }
    } catch (error) {
      console.error('❌ Erro na auditoria:', error);
    }
  }

  static getRecentRequests(userId: string, requestTracker: Map<string, number>): any[] {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    return Array.from(requestTracker.entries())
      .filter(([key, timestamp]) => key.includes(userId) && timestamp > oneHourAgo)
      .map(([key, timestamp]) => ({
        key,
        timestamp,
        region: key.split('_')[2] || 'BR',
        timeAgo: now - timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  static async isIPBlacklisted(ip: string): Promise<boolean> {
    try {
      const data = await httpClient.get<{ blacklisted: boolean }>(`/api/security/ip-check/${ip}`);
      return data.blacklisted || false;
    } catch (error) {
      console.warn('Falha ao verificar blacklist IP:', error);
      return false;
    }
  }

  static calculateRiskScore(userId: string, userHistory: any): number {
    let riskScore = 0;

    if (userHistory.previousBlocks > 0) {
      riskScore += userHistory.previousBlocks * 20;
    }

    const accountAge = Date.now() - new Date(userHistory.createdAt).getTime();
    if (accountAge < 7 * 24 * 60 * 60 * 1000) {
      riskScore += 15;
    }

    if (userHistory.failedLogins > 5) {
      riskScore += userHistory.failedLogins * 5;
    }

    if (userHistory.suspiciousPatterns > 0) {
      riskScore += userHistory.suspiciousPatterns * 10;
    }

    return Math.min(riskScore, 100);
  }

  static shouldThrottleUser(userId: string, riskScore: number): boolean {
    return riskScore > 50;
  }
}

export default Security;
