/* eslint-disable @typescript-eslint/indent */
/* eslint-disable no-undef */
import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor'

Given('I navigate to the website', () => {
    cy.visit('localhost:3000')
})
When('I enter site', () => {
    cy.url().should('include', 'localhost')
})
Then('Check title', () => {
    cy.get('h1').contains('Nuxt Starter')
})
