const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- DATABASE QUESTION AUDIT & NORMALIZATION ---');
  const challenges = await prisma.challenge.findMany();
  let normalizedCount = 0;
  const issuesFound = [];

  for (const c of challenges) {
    const config = c.config || {};
    let needsUpdate = false;
    let newConfig = { ...config };

    if (c.type === 'MULTIPLE_CHOICE' || c.type === 'MULTI_CHOICE') {
      if (typeof config.answer === 'string') {
        newConfig.answer = [config.answer];
        needsUpdate = true;
        issuesFound.push({
          id: c.id,
          type: c.type,
          issue: `Answer was string "${config.answer}", normalized to array ["${config.answer}"]`
        });
      }
    } else if (c.type === 'SINGLE_CHOICE' || c.type === 'CHOICE') {
      if (Array.isArray(config.answer)) {
        if (config.answer.length === 1) {
          newConfig.answer = config.answer[0];
          needsUpdate = true;
          issuesFound.push({
            id: c.id,
            type: c.type,
            issue: `Answer was array ${JSON.stringify(config.answer)}, normalized to string "${config.answer[0]}"`
          });
        } else if (config.answer.length > 1) {
          issuesFound.push({
            id: c.id,
            type: c.type,
            issue: `FLAGGED FOR REVIEW: Single choice has multiple answers: ${JSON.stringify(config.answer)}`
          });
        }
      }
    } else if (c.type === 'TRUE_FALSE') {
      const opts = config.options || [];
      const isClean = opts.length === 2 && opts[0] === 'True' && opts[1] === 'False';
      if (!isClean) {
        newConfig.options = ['True', 'False'];
        needsUpdate = true;
      }
      if (config.answer !== 'True' && config.answer !== 'False') {
        const lower = String(config.answer).toLowerCase();
        newConfig.answer = lower === 'false' ? 'False' : 'True';
        needsUpdate = true;
      }
      if (needsUpdate) {
        issuesFound.push({
          id: c.id,
          type: c.type,
          issue: `Normalized True/False options/answer for ${c.id}`
        });
      }
    }

    if (needsUpdate) {
      await prisma.challenge.update({
        where: { id: c.id },
        data: { config: newConfig }
      });
      normalizedCount++;
    }
  }

  console.log(`Audit complete. Issues found / processed: ${issuesFound.length}`);
  console.log(`Challenges normalized in database: ${normalizedCount}`);
  console.log(JSON.stringify(issuesFound, null, 2));
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
