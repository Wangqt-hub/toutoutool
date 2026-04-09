import { EmojiLoadingStage } from "@/components/mascot/EmojiLoadingStage";
import {
  toolsEntryLoadingSlides,
  TOOLS_ENTRY_AUTOPLAY_MS
} from "@/components/mascot/tools-entry-loading";

export default function DashboardLoading() {
  return (
    <EmojiLoadingStage
      slides={toolsEntryLoadingSlides}
      autoPlayMs={TOOLS_ENTRY_AUTOPLAY_MS}
      fullScreen={false}
      showBrand={false}
      className="py-6"
    />
  );
}
