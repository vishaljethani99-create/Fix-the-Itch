export default function Home() {
  return (
    <main>
      <h1>Fix the Itch</h1>
      <p>The communication API is running.</p>
      <ul>
        <li>POST /api/compose to turn recognized signs into a sentence.</li>
        <li>POST /api/simplify to simplify spoken text for a signer.</li>
      </ul>
    </main>
  );
}
