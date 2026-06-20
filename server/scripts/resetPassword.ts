import bcrypt from 'bcrypt';
import { prisma } from '../Controller/prismaClient';

async function main() {
  const [, , employeeIdArg, newPasswordArg] = process.argv;
  if (!employeeIdArg || !newPasswordArg) {
    console.error('Usage: node resetPassword.js <EMPLOYEE_ID> <NEW_PASSWORD>');
    process.exit(2);
  }
  const employeeId = employeeIdArg.trim();
  const newPassword = newPasswordArg;
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(2);
  }
  const user = await prisma.user.findFirst({ where: { employeeId: { equals: employeeId, mode: 'insensitive' } } });
  if (!user) {
    console.error('No user found with employeeId=', employeeId);
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  console.log(`Password for ${employeeId} (id=${user.id}) updated successfully.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
