async function test() {
  try {
    console.log("Checking if local server is running on port 3001...");
    const res = await fetch('http://localhost:3001/api/data');
    if (res.ok) {
      const data = await res.json();
      console.log("✅ Local server is running!");
      console.log("- Data size (quotes):", data.quotes ? data.quotes.length : 0);
      console.log("- Main DB keys:", Object.keys(data).filter(k => k !== 'quotes'));
    } else {
      console.log("❌ Local server returned error status:", res.status);
    }
  } catch (e) {
    console.log("❌ Local server is not running or unreachable:", e.message);
  }
}

test();
