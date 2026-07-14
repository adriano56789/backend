"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNetEarnings = exports.calculateBRLFromDiamonds = exports.PLATFORM_FEE_RATE = exports.DIAMOND_PACKAGES = void 0;
// Tabela de conversão de diamantes para dinheiro baseada nos pacotes
exports.DIAMOND_PACKAGES = [
    { diamonds: 800, brl: 7.00 },
    { diamonds: 3000, brl: 25.00 },
    { diamonds: 6000, brl: 60.00 },
    { diamonds: 20000, brl: 180.00 },
    { diamonds: 36000, brl: 350.00 },
    { diamonds: 65000, brl: 600.00 }
];
// Taxa da plataforma (20%)
exports.PLATFORM_FEE_RATE = 0.20;
/**
 * Calcular valor em BRL baseado nos diamantes usando a tabela de pacotes
 * Prioriza pacotes exatos, depois calcula por combinação de pacotes
 */
const calculateBRLFromDiamonds = (diamonds) => {
    if (diamonds <= 0)
        return 0;
    // Primeiro, verificar se há um pacote exato
    const exactPackage = exports.DIAMOND_PACKAGES.find(pkg => pkg.diamonds === diamonds);
    if (exactPackage) {
        return exactPackage.brl;
    }
    // Se não houver pacote exato, calcular por combinação de pacotes (do maior para o menor)
    const sortedPackages = [...exports.DIAMOND_PACKAGES].sort((a, b) => b.diamonds - a.diamonds);
    let remainingDiamonds = diamonds;
    let totalBRL = 0;
    for (const package_ of sortedPackages) {
        if (remainingDiamonds <= 0)
            break;
        const packagesCount = Math.floor(remainingDiamonds / package_.diamonds);
        if (packagesCount > 0) {
            totalBRL += packagesCount * package_.brl;
            remainingDiamonds -= packagesCount * package_.diamonds;
        }
    }
    // Se ainda restarem diamantes, usar o menor pacote para o restante
    if (remainingDiamonds > 0 && sortedPackages.length > 0) {
        const smallestPackage = sortedPackages[sortedPackages.length - 1];
        const ratePerDiamond = smallestPackage.brl / smallestPackage.diamonds;
        totalBRL += remainingDiamonds * ratePerDiamond;
    }
    return totalBRL;
};
exports.calculateBRLFromDiamonds = calculateBRLFromDiamonds;
/**
 * Calcular earnings líquidos do streamer após desconto da plataforma
 */
const calculateNetEarnings = (diamonds) => {
    const gross = (0, exports.calculateBRLFromDiamonds)(diamonds);
    const platformFee = gross * exports.PLATFORM_FEE_RATE;
    const net = gross - platformFee;
    return {
        gross,
        platformFee,
        net
    };
};
exports.calculateNetEarnings = calculateNetEarnings;
