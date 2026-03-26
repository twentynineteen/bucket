/**
 * Appearance Settings Section
 *
 * Theme selector accordion wrapper.
 */
import { ThemeSelector } from '@shared/ui/theme/ThemeSelector'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@shared/ui/accordion'
import React from 'react'

const AppearanceSection: React.FC = () => {
  return (
    <section
      id="appearance"
      className="border-border space-y-4 rounded-lg border p-6 scroll-mt-16"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">Appearance</h3>
        <p className="text-muted-foreground text-sm">
          Customize the visual theme and color scheme
        </p>
      </div>
      <Accordion type="single" collapsible defaultValue="theme">
        <AccordionItem value="theme" className="border-b-0">
          <AccordionTrigger className="hover:no-underline">
            Theme Selection
          </AccordionTrigger>
          <AccordionContent>
            <ThemeSelector label="" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}

export default AppearanceSection
