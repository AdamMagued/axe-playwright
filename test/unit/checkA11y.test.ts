import { checkA11y } from '../../src'
import { Page } from 'playwright'
import { createHtmlReport } from 'axe-html-reporter'
import { Result } from 'axe-core'

jest.mock('axe-html-reporter', () => ({
  createHtmlReport: jest.fn(),
}))

describe('checkA11y with includedImpacts', () => {
  const createMockResult = (id: string, impact: Result['impact']): Result =>
    ({
      id,
      impact,
      description: `Description for ${id}`,
      help: `Help for ${id}`,
      helpUrl: `https://example.com/${id}`,
      tags: ['wcag2a'],
      nodes: [],
    }) as Result

  const mockViolations: Result[] = [
    createMockResult('crit-rule', 'critical'),
    createMockResult('serious-rule', 'serious'),
    createMockResult('mod-rule', 'moderate'),
    createMockResult('minor-rule', 'minor'),
  ]

  let mockPage: Page

  beforeEach(() => {
    jest.clearAllMocks()
    mockPage = {
      evaluate: jest.fn().mockResolvedValue({ violations: mockViolations }),
    } as unknown as Page
  })

  describe('nested axeOptions.includedImpacts', () => {
    it('filters violations properly when nested in axeOptions', async () => {
      const customReporter = { report: jest.fn() }
      await checkA11y(
        mockPage,
        undefined,
        { axeOptions: { includedImpacts: ['critical', 'serious'] } },
        true,
        customReporter,
      )

      expect(customReporter.report).toHaveBeenCalledTimes(1)
      expect(customReporter.report).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'crit-rule', impact: 'critical' }),
        expect.objectContaining({ id: 'serious-rule', impact: 'serious' }),
      ])
    })

    it('does not throw when nested includedImpacts filters out all violations', async () => {
      const moderateOnlyPage = {
        evaluate: jest.fn().mockResolvedValue({
          violations: [createMockResult('mod-rule', 'moderate')],
        }),
      } as unknown as Page

      await expect(
        checkA11y(
          moderateOnlyPage,
          undefined,
          { axeOptions: { includedImpacts: ['critical'] } },
          false,
        ),
      ).resolves.not.toThrow()
    })
  })

  describe('html reporter with includedImpacts', () => {
    it('passes impactedViolations to createHtmlReport when top-level includedImpacts is set', async () => {
      const reportOptions = { reportFileName: 'report.html' }
      await checkA11y(
        mockPage,
        undefined,
        { includedImpacts: ['critical'] },
        true,
        'html',
        reportOptions,
      )

      expect(createHtmlReport).toHaveBeenCalledTimes(1)
      expect(createHtmlReport).toHaveBeenCalledWith({
        results: {
          violations: [
            expect.objectContaining({ id: 'crit-rule', impact: 'critical' }),
          ],
        },
        options: reportOptions,
      })
    })

    it('passes impactedViolations to createHtmlReport when nested axeOptions.includedImpacts is set', async () => {
      const reportOptions = { reportFileName: 'report.html' }
      await checkA11y(
        mockPage,
        undefined,
        { axeOptions: { includedImpacts: ['serious'] } },
        true,
        'html',
        reportOptions,
      )

      expect(createHtmlReport).toHaveBeenCalledTimes(1)
      expect(createHtmlReport).toHaveBeenCalledWith({
        results: {
          violations: [
            expect.objectContaining({ id: 'serious-rule', impact: 'serious' }),
          ],
        },
        options: reportOptions,
      })
    })

    it('does not create HTML report or fail test when no violations match includedImpacts', async () => {
      const moderateOnlyPage = {
        evaluate: jest.fn().mockResolvedValue({
          violations: [createMockResult('mod-rule', 'moderate')],
        }),
      } as unknown as Page

      await expect(
        checkA11y(
          moderateOnlyPage,
          undefined,
          { axeOptions: { includedImpacts: ['critical'] } },
          false,
          'html',
        ),
      ).resolves.not.toThrow()

      expect(createHtmlReport).not.toHaveBeenCalled()
    })
  })
})
