import { prisma } from "../Controller/prismaClient";

async function main() {
  const reps = await prisma.user.findMany({
    where: { role: "receptionist" },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      email: true,
      phone: true,
      clinicId: true,
      department: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log(JSON.stringify(reps, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .then(() => process.exit(0));
