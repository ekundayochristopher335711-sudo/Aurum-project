import { PrismaClient, Role, ContractType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('Admin1234!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aurum.com' },
    update: {},
    create: {
      email: 'admin@aurum.com',
      password: adminPassword,
      name: 'System Admin',
      role: Role.ADMIN,
    },
  })

  const cmPassword = await bcrypt.hash('Manager1234!', 12)
  const cm = await prisma.user.upsert({
    where: { email: 'manager@aurum.com' },
    update: {},
    create: {
      email: 'manager@aurum.com',
      password: cmPassword,
      name: 'Commercial Manager',
      role: Role.COMMERCIAL_MANAGER,
    },
  })

  const project = await prisma.project.upsert({
    where: { id: 'seed-project-001' },
    update: {},
    create: {
      id: 'seed-project-001',
      name: 'M25 Motorway Extension Phase 2',
      description: 'Major highway infrastructure project under NEC4 ECC contract',
      contractType: ContractType.NEC4,
      clientName: 'National Highways',
      contractorName: 'Aurum Civil Engineering Ltd',
      contractValue: 45000000,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2026-06-30'),
      members: {
        create: [
          { userId: admin.id, role: Role.ADMIN },
          { userId: cm.id, role: Role.COMMERCIAL_MANAGER },
        ],
      },
    },
  })

  console.log('Seed complete.')
  console.log('Admin login: admin@aurum.com / Admin1234!')
  console.log('Manager login: manager@aurum.com / Manager1234!')
  console.log('Demo project:', project.name)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
