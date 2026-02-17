/**
 * Clipboard utility with fallback for restricted contexts
 * Handles permissions policy errors gracefully without console warnings
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first (silently)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Silently fall through to legacy method
      // This is expected in iframe/restricted contexts
    }
  }

  // Fallback: Use legacy execCommand method
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea invisible but accessible
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.setAttribute('readonly', '');
    
    document.body.appendChild(textArea);
    
    // Focus and select the text
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    
    // Execute copy command
    const successful = document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(textArea);
    
    if (!successful) {
      console.error('Copy to clipboard failed: execCommand returned false');
    }
    
    return successful;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}