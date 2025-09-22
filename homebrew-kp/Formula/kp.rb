# typed: false
# frozen_string_literal: true

class Kp < Formula
  desc "Kill the process bound to a TCP port"
  homepage "https://github.com/aboutmydreams/kp"
  url "https://github.com/aboutmydreams/kp/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "ac181dfba8b7d409a918294ba2dfada45590a3f47f8092d8e2826312a2c52194"
  license "MIT"

  depends_on "node"

  def install
    libexec.install Dir["*"]
    (bin/"kp").write_env_script libexec/"bin/kp.js"
  end

  test do
    assert_match "Usage: kp", shell_output("#{bin}/kp --help")
  end
end
