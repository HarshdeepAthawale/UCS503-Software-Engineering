-- Monthly stipend amount (INR) when stipend = true.
ALTER TABLE "opportunities" ADD COLUMN "stipend_amount" DECIMAL(10, 2);
