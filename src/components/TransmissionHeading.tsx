type TransmissionHeadingProps = {
  sequence: string;
  title: string;
  metadata?: string;
};

function TransmissionHeading({
  sequence,
  title,
  metadata,
}: TransmissionHeadingProps) {
  return (
    <>
      <span className="about-page__heading-sequence">{sequence}</span>
      <span className="about-page__heading-structure">
        {metadata ? ` // ${metadata} // ` : " // "}
      </span>
      <span className="about-page__heading-title">{title}</span>
    </>
  );
}

export default TransmissionHeading;