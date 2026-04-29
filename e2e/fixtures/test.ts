import { test as base } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { CreatePage } from '../pages/CreatePage'
import { StyleEditorPage } from '../pages/StyleEditorPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { DashboardPage } from '../pages/DashboardPage'

type Fixtures = {
  loginPage: LoginPage
  createPage: CreatePage
  styleEditorPage: StyleEditorPage
  checkoutPage: CheckoutPage
  dashboardPage: DashboardPage
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  createPage: async ({ page }, use) => use(new CreatePage(page)),
  styleEditorPage: async ({ page }, use) => use(new StyleEditorPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
})

export { expect } from '@playwright/test'
