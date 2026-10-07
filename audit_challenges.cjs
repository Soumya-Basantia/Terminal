const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function audit() {
  const challenges = await p.challenge.findMany({
    include: { game: { select: { id: true, name: true, template: true } } }
  });

  const report = [];
  for (const c of challenges) {
    const cfg = c.config || {};
    const opts = cfg.options;
    const ans = cfg.answer;
    const issues = [];

    if (c.type === 'SINGLE_CHOICE' || c.type === 'CHOICE') {
      if (Array.isArray(ans)) issues.push('SINGLE has multiple answers: ' + JSON.stringify(ans));
      if (opts && !opts.includes(ans) && !['A','B','C','D'].includes(ans)) {
        issues.push('Answer not in options: ' + ans);
      }
    }
    if (c.type === 'TRUE_FALSE') {
      if (!opts || opts.length !== 2 || !opts.includes('True') || !opts.includes('False')) {
        issues.push('TRUE_FALSE options not True/False: ' + JSON.stringify(opts));
      }
      if (ans !== 'True' && ans !== 'False') {
        issues.push('TRUE_FALSE answer not True/False: ' + ans);
      }
    }
    if (c.type === 'MULTIPLE_CHOICE' || c.type === 'MULTI_CHOICE') {
      if (!Array.isArray(ans)) {
        issues.push('MULTIPLE_CHOICE answer is not array: ' + JSON.stringify(ans));
      }
    }
    if (issues.length) {
      report.push({
        id: c.id,
        prompt: c.prompt,
        game: c.game?.name,
        template: c.game?.template,
        type: c.type,
        issues,
        config: cfg
      });
    }
  }

  console.log(`Total challenges: ${challenges.length}`);
  console.log(`Challenges with issues: ${report.length}`);
  console.log(JSON.stringify(report, null, 2));
}

audit().catch(console.error).finally(() => p.$disconnect());
