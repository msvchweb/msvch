import Image from "next/image";

interface Props {
  content: string;
  title?: string;
}

/**
 * 네이버 블로그에서 퍼온 글 렌더링.
 * 본문 중간에 [IMG:url] 마커가 있으면 해당 위치에 이미지를 삽입.
 */
export function BlogContent({ content, title = "" }: Props) {
  const parts = content.split(/(\[IMG:[^\]]+\])/g);

  return (
    <div className="space-y-4">
      {parts.map((part, i) => {
        const imgMatch = part.match(/^\[IMG:(.+)\]$/);
        if (imgMatch) {
          return (
            <div key={i} className="relative w-full overflow-hidden rounded-xl">
              <Image
                src={imgMatch[1]}
                alt={`${title} 이미지`}
                width={800}
                height={600}
                className="h-auto w-full object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          );
        }
        const text = part.trim();
        return text ? (
          <p key={i} className="whitespace-pre-line leading-relaxed text-gray-700">
            {text}
          </p>
        ) : null;
      })}
    </div>
  );
}
