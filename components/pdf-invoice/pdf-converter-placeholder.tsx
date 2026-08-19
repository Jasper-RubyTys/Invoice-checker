import { Construction, HardHat, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

/**
 * Shown instead of the real PDF Converter on the static demo deployment
 * (NEXT_PUBLIC_STATIC_EXPORT), which has no server to run the Python
 * extractor — uploading is disabled entirely rather than left to fail
 * after the fact.
 */
export function PdfConverterPlaceholder() {
  return (
    <div className="dropzone-fill flex items-center justify-center">
      <Card className="max-w-md text-center overflow-hidden">
        <div className="construction-hazard-bar -m-4 mb-0" aria-hidden="true" />
        <div className="flex flex-col items-center gap-4 p-8">
          <span className="construction-icon text-foreground-muted">
            <Construction size={40} strokeWidth={1.5} />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Nog in de steigers</h2>
            <p className="text-sm text-foreground-muted">
              De PDF Converter leest facturen uit met een Python-server die in deze demo-omgeving
              niet draait. Uploaden is hier daarom uitgeschakeld — in de volledige app werkt deze
              functie gewoon.
            </p>
          </div>
          <div className="construction-upload-mock" aria-disabled="true">
            <Upload size={16} />
            <span className="text-sm">Uploaden niet beschikbaar</span>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="orange">Demo-versie</Chip>
            <Chip tone="gray">
              <HardHat size={12} className="inline -mt-0.5 mr-1" />
              Binnenkort live
            </Chip>
          </div>
        </div>
      </Card>
    </div>
  );
}
